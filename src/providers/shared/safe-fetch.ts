import type { LookupAddress } from "node:dns";
import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { Readable } from "node:stream";

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const DEFAULT_CONTENT_TYPES = ["text/html", "application/xhtml+xml"];

type ResolveHost = (hostname: string) => Promise<readonly string[]>;
type FetchImpl = (input: string, init: RequestInit) => Promise<Response>;

export interface SafeFetchOptions {
  allowedHosts?: readonly string[];
  contentTypes?: readonly string[];
  fetchImpl?: FetchImpl;
  maxBytes?: number;
  maxRedirects?: number;
  resolveHost?: ResolveHost;
  timeoutMs?: number;
  userAgent?: string;
}

export class SafeFetchError extends Error {
  constructor(
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "SafeFetchError";
  }
}

function normalizedHost(hostname: string): string {
  return hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
}

function ipv4Parts(address: string): number[] | null {
  if (isIP(address) !== 4) return null;
  return address.split(".").map(Number);
}

function embeddedIpv4(address: string): string | null {
  const match = address.match(/(?:^|:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  return match?.[1] ?? null;
}

function ipv6Groups(rawAddress: string): number[] | null {
  let address = rawAddress;
  const embedded = embeddedIpv4(address);
  if (embedded) {
    const parts = ipv4Parts(embedded);
    if (!parts) return null;
    address =
      address.slice(0, -embedded.length) +
      `${((parts[0] << 8) | parts[1]).toString(16)}:${((parts[2] << 8) | parts[3]).toString(16)}`;
  }
  const halves = address.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return null;
  const groups = [
    ...left,
    ...Array.from({ length: missing }, () => "0"),
    ...right,
  ];
  if (
    groups.length !== 8 ||
    groups.some((group) => !/^[\da-f]{1,4}$/i.test(group))
  )
    return null;
  return groups.map((group) => Number.parseInt(group, 16));
}

export function isPublicAddress(rawAddress: string): boolean {
  const address = normalizedHost(rawAddress);
  const ipv4 = ipv4Parts(address);
  if (ipv4) {
    const [a, b, c] = ipv4;
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 168) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224
    );
  }

  if (isIP(address) !== 6) return false;
  const groups = ipv6Groups(address);
  if (!groups) return false;
  const [first] = groups;
  if (
    groups.slice(0, 5).every((group) => group === 0) &&
    groups[5] === 0xffff
  ) {
    return isPublicAddress(
      `${groups[6] >>> 8}.${groups[6] & 255}.${groups[7] >>> 8}.${groups[7] & 255}`,
    );
  }
  return !(
    groups.every((group) => group === 0) ||
    (groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1) ||
    (first & 0xfe00) === 0xfc00 ||
    (first & 0xffc0) === 0xfe80 ||
    (first & 0xff00) === 0xff00 ||
    (groups[0] === 0x2001 && groups[1] === 0x0db8)
  );
}

async function defaultResolveHost(
  hostname: string,
): Promise<readonly string[]> {
  const direct = normalizedHost(hostname);
  if (isIP(direct)) return [direct];
  return (await lookup(direct, { all: true, verbatim: true })).map(
    ({ address }) => address,
  );
}

function nativeSafeFetch(input: string, init: RequestInit): Promise<Response> {
  const url = new URL(input);
  const request = url.protocol === "https:" ? httpsRequest : httpRequest;
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        headers: init.headers as Record<string, string>,
        signal: init.signal ?? undefined,
        lookup(hostname, options, callback) {
          defaultResolveHost(hostname).then(
            (addresses) => {
              if (
                addresses.length === 0 ||
                addresses.some((address) => !isPublicAddress(address))
              ) {
                callback(
                  new SafeFetchError(
                    "DNS resolved to a non-public network address.",
                  ),
                  "",
                );
                return;
              }
              const records: LookupAddress[] = addresses.map((address) => ({
                address,
                family: isIP(address) as 4 | 6,
              }));
              if (options.all) {
                callback(null, records);
              } else {
                const requestedFamily =
                  options.family === 4 || options.family === 6
                    ? options.family
                    : null;
                const record =
                  records.find(
                    ({ family }) =>
                      !requestedFamily || family === requestedFamily,
                  ) ?? records[0];
                callback(null, record.address, record.family);
              }
            },
            (error) => callback(error as NodeJS.ErrnoException, ""),
          );
        },
      },
      (response) => {
        try {
          const headers = new Headers();
          for (const [name, value] of Object.entries(response.headers)) {
            if (Array.isArray(value)) {
              value.forEach((item) => headers.append(name, item));
            } else if (value !== undefined) {
              headers.set(name, value);
            }
          }
          const status = response.statusCode ?? 500;
          const body = [101, 204, 205, 304].includes(status)
            ? null
            : (Readable.toWeb(response) as ReadableStream<Uint8Array>);
          resolve(
            new Response(body, {
              headers,
              status,
              statusText: response.statusMessage,
            }),
          );
        } catch (error) {
          response.destroy();
          reject(error);
        }
      },
    );
    req.on("error", reject);
    req.end();
  });
}

export async function assertSafePublicUrl(
  rawUrl: string | URL,
  options: Pick<SafeFetchOptions, "allowedHosts" | "resolveHost"> = {},
): Promise<URL> {
  let url: URL;
  try {
    url = rawUrl instanceof URL ? new URL(rawUrl) : new URL(rawUrl);
  } catch {
    throw new SafeFetchError("Invalid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SafeFetchError("Only HTTP(S) URLs are allowed.");
  }
  if (url.username || url.password)
    throw new SafeFetchError("URLs containing credentials are not allowed.");

  const hostname = normalizedHost(url.hostname);
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new SafeFetchError("Local network addresses are not allowed.");
  }
  if (options.allowedHosts?.length) {
    const allowed = options.allowedHosts.some((rawAllowed) => {
      const allowedHost = normalizedHost(rawAllowed);
      return hostname === allowedHost || hostname.endsWith(`.${allowedHost}`);
    });
    if (!allowed)
      throw new SafeFetchError(
        `URL host "${hostname}" is not allowed for this provider.`,
      );
  }

  if (isIP(hostname) && !isPublicAddress(hostname)) {
    throw new SafeFetchError(
      "Local, private, link-local, and reserved network addresses are not allowed.",
    );
  }

  let addresses: readonly string[];
  try {
    addresses = isIP(hostname)
      ? [hostname]
      : await (options.resolveHost ?? defaultResolveHost)(hostname);
  } catch {
    throw new SafeFetchError(`Could not resolve URL host "${hostname}".`, true);
  }
  if (
    addresses.length === 0 ||
    addresses.some((address) => !isPublicAddress(address))
  ) {
    throw new SafeFetchError(
      "Local, private, link-local, and reserved network addresses are not allowed.",
    );
  }
  return url;
}

async function readBoundedBody(
  response: Response,
  maxBytes: number,
): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new SafeFetchError(`Response exceeds the ${maxBytes}-byte limit.`);
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let body = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new SafeFetchError(`Response exceeds the ${maxBytes}-byte limit.`);
    }
    body += decoder.decode(value, { stream: true });
  }
  return body + decoder.decode();
}

export async function safeFetchText(
  rawUrl: string,
  options: SafeFetchOptions = {},
): Promise<string> {
  const fetchImpl = options.fetchImpl ?? nativeSafeFetch;
  const maxBytes = options.maxBytes ?? 2_000_000;
  const maxRedirects = options.maxRedirects ?? 5;
  const acceptedTypes = options.contentTypes ?? DEFAULT_CONTENT_TYPES;
  let currentUrl = rawUrl;

  for (let redirects = 0; redirects <= maxRedirects; redirects++) {
    const url = await assertSafePublicUrl(currentUrl, options);
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      options.timeoutMs ?? 15_000,
    );
    try {
      const response = await fetchImpl(url.toString(), {
        headers: {
          Accept: acceptedTypes.join(","),
          "Accept-Encoding": "identity",
          ...(options.userAgent ? { "User-Agent": options.userAgent } : {}),
        },
        redirect: "manual",
        signal: controller.signal,
      });

      if (REDIRECT_STATUSES.has(response.status)) {
        const location = response.headers.get("location");
        if (!location)
          throw new SafeFetchError(
            `Redirect response ${response.status} has no Location header.`,
          );
        if (redirects === maxRedirects)
          throw new SafeFetchError("Too many redirects.");
        currentUrl = new URL(location, url).toString();
        continue;
      }
      if (!response.ok)
        throw new SafeFetchError(
          `Fetch failed with status ${response.status}.`,
        );

      const contentType = response.headers
        .get("content-type")
        ?.split(";", 1)[0]
        .trim()
        .toLowerCase();
      if (
        !contentType ||
        !acceptedTypes.some(
          (allowed) =>
            contentType === allowed ||
            (allowed.endsWith("/*") &&
              contentType.startsWith(allowed.slice(0, -1))),
        )
      ) {
        throw new SafeFetchError(
          `Unsupported response content type: ${contentType ?? "missing"}.`,
        );
      }
      return await readBoundedBody(response, maxBytes);
    } catch (error) {
      if (error instanceof SafeFetchError) throw error;
      if (controller.signal.aborted)
        throw new SafeFetchError("Fetch timed out.", true);
      throw new SafeFetchError(
        error instanceof Error ? error.message : "Fetch failed.",
        true,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new SafeFetchError("Too many redirects.");
}
