import { safeFetchText } from "./safe-fetch";
import { fetchViaWorker, type ScraperWorkerFallback } from "./remote-fetch";

// Minimal shared robots.txt check: fetch the target
// origin's robots.txt and evaluate whether our exact user-agent (falling
// back to "*") is allowed to fetch the given path. Deliberately simple —
// this only needs to cover the "Disallow" case for a single path lookup.

interface RobotsRuleSet {
  disallow: string[];
  allow: string[];
}

function parseRobotsTxt(text: string, userAgent: string): RobotsRuleSet {
  const lines = text.split("\n").map((l) => l.trim());
  const groups: {
    agents: string[];
    rules: { type: "allow" | "disallow"; path: string }[];
  }[] = [];
  let current: {
    agents: string[];
    rules: { type: "allow" | "disallow"; path: string }[];
  } | null = null;

  for (const rawLine of lines) {
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();

    if (key === "user-agent") {
      if (!current || current.rules.length > 0) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if ((key === "disallow" || key === "allow") && current) {
      current.rules.push({ type: key, path: value });
    }
  }

  const agentLower = userAgent.toLowerCase();
  const specific = groups.find((g) =>
    g.agents.some((a) => agentLower.includes(a) && a !== "*"),
  );
  const wildcard = groups.find((g) => g.agents.includes("*"));
  const chosen = specific ?? wildcard;

  if (!chosen) return { disallow: [], allow: [] };
  return {
    disallow: chosen.rules
      .filter((r) => r.type === "disallow" && r.path)
      .map((r) => r.path),
    allow: chosen.rules
      .filter((r) => r.type === "allow" && r.path)
      .map((r) => r.path),
  };
}

function isAllowedByRuleSet(rules: RobotsRuleSet, path: string): boolean {
  const matchingDisallow = rules.disallow
    .filter((rule) => path.startsWith(rule))
    .sort((a, b) => b.length - a.length)[0];
  const matchingAllow = rules.allow
    .filter((rule) => path.startsWith(rule))
    .sort((a, b) => b.length - a.length)[0];

  if (!matchingDisallow) return true;
  if (matchingAllow && matchingAllow.length >= matchingDisallow.length)
    return true;
  return false;
}

// Some sites (confirmed for ImmoScout24.at) serve a stricter robots.txt to
// datacenter/cloud IP ranges than to a normal residential connection — the
// same "rejects Vercel/native HTTP" behavior the Railway scraper worker
// (remote-fetch.ts) already exists to route around for the page fetch
// itself. When a worker fallback is configured for this host and the
// native read says "disallowed" (or fails outright), re-fetch robots.txt
// through the worker's different network path before actually blocking —
// otherwise a Vercel-specific decoy robots.txt silently disables the very
// fallback that was built to handle this exact site.
export async function isFetchAllowedByRobots(
  targetUrl: string,
  userAgent: string,
  workerFallback: ScraperWorkerFallback | null = null,
): Promise<boolean> {
  const url = new URL(targetUrl);
  const robotsUrl = `${url.protocol}//${url.host}/robots.txt`;
  const path = url.pathname + url.search;

  let text: string;
  try {
    text = await safeFetchText(robotsUrl, {
      allowedHosts: [url.hostname],
      contentTypes: ["text/plain", "text/*"],
      maxBytes: 256_000,
      timeoutMs: 5_000,
      userAgent,
    });
  } catch {
    if (!workerFallback) return true;
    return fetchRobotsViaWorker(robotsUrl, userAgent, path, workerFallback, true);
  }

  if (isAllowedByRuleSet(parseRobotsTxt(text, userAgent), path)) return true;
  if (!workerFallback) return false;
  return fetchRobotsViaWorker(robotsUrl, userAgent, path, workerFallback, false);
}

async function fetchRobotsViaWorker(
  robotsUrl: string,
  userAgent: string,
  path: string,
  workerFallback: ScraperWorkerFallback,
  defaultOnFailure: boolean,
): Promise<boolean> {
  try {
    const result = await fetchViaWorker(
      robotsUrl,
      workerFallback.transports,
      workerFallback.config,
    );
    return isAllowedByRuleSet(parseRobotsTxt(result.html, userAgent), path);
  } catch {
    return defaultOnFailure;
  }
}
