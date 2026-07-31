// Shared real HTTP fetch used by provider adapters: robots.txt
// check, a real browser User-Agent (per-user decision — see AGENTS.md and the
// conversation that authorized this), a request timeout, one retry on
// network/timeout failure, and a per-host rate limit so imports don't hammer
// the target site.

import { isFetchAllowedByRobots } from "./robots";
import { waitForRateLimit } from "./rate-limit";
import { safeFetchText, SafeFetchError } from "./safe-fetch";

export const BROWSER_USER_AGENT =
  process.env.IMPORTER_USER_AGENT ??
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const MIN_DELAY_MS = Number(process.env.SCRAPER_MIN_DELAY_MS ?? 4000);

export async function fetchHtml(
  url: string,
  allowedHosts?: readonly string[],
): Promise<string> {
  const host = new URL(url).hostname;

  const allowed = await isFetchAllowedByRobots(url, BROWSER_USER_AGENT);
  if (!allowed) {
    throw new Error(
      `robots.txt for ${host} disallows fetching this path. Use manual entry instead.`,
    );
  }

  await waitForRateLimit(host, MIN_DELAY_MS);

  try {
    return await safeFetchText(url, {
      allowedHosts,
      userAgent: BROWSER_USER_AGENT,
    });
  } catch (error) {
    if (!(error instanceof SafeFetchError) || !error.retryable) throw error;
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await waitForRateLimit(host, MIN_DELAY_MS);
    return await safeFetchText(url, {
      allowedHosts,
      userAgent: BROWSER_USER_AGENT,
    });
  }
}
