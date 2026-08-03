import { createHmac } from "node:crypto";
import { z } from "zod";
import { getEnv } from "@/lib/env";

export type RemoteTransport = "curl" | "browser" | "cloak";

export interface ScraperWorkerConfig {
  url: string;
  secret: string;
}

export interface ScraperWorkerFallback {
  config: ScraperWorkerConfig;
  transports: RemoteTransport[];
}

const workerResponse = z.object({
  html: z.string().max(2_000_000),
  finalUrl: z.url(),
  transport: z.enum(["curl", "browser", "cloak"]),
  status: z.number().int().min(100).max(599),
});

export function createWorkerSignature(
  secret: string,
  timestamp: string,
  body: string,
) {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
}

export function getScraperWorkerFallback(): ScraperWorkerFallback | null {
  const env = getEnv();
  if (
    env.SCRAPER_WORKER_ENABLED !== "true" ||
    !env.SCRAPER_WORKER_URL ||
    !env.SCRAPER_WORKER_SECRET
  )
    return null;
  return {
    config: {
      url: new URL("/v1/fetch", env.SCRAPER_WORKER_URL).toString(),
      secret: env.SCRAPER_WORKER_SECRET,
    },
    transports:
      env.SCRAPER_WORKER_STEALTH === "true"
        ? ["curl", "browser", "cloak"]
        : ["curl", "browser"],
  };
}

export async function fetchViaWorker(
  url: string,
  transports: RemoteTransport[],
  config: ScraperWorkerConfig,
  fetchImpl: typeof fetch = fetch,
  now = Date.now(),
) {
  const body = JSON.stringify({ url, transports });
  const timestamp = String(Math.floor(now / 1000));
  const response = await fetchImpl(config.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-appscanner-timestamp": timestamp,
      "x-appscanner-signature": createWorkerSignature(
        config.secret,
        timestamp,
        body,
      ),
    },
    body,
    signal: AbortSignal.timeout(transports.includes("cloak") ? 90_000 : 60_000),
  });
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > 2_100_000)
    throw new Error("Scraper worker response exceeds 2.1 MB.");
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > 2_100_000)
    throw new Error("Scraper worker response exceeds 2.1 MB.");
  if (!response.ok)
    throw new Error(
      `Scraper worker failed with status ${response.status}: ${text.slice(0, 300)}`,
    );
  if (!response.headers.get("content-type")?.startsWith("application/json"))
    throw new Error("Scraper worker returned a non-JSON response.");
  return workerResponse.parse(JSON.parse(text));
}
