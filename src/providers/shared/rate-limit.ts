// Per-host throttle so repeated real-page fetches don't hammer a site.

const nextRequestAt = new Map<string, number>();

export async function waitForRateLimit(
  host: string,
  minDelayMs: number,
): Promise<void> {
  const now = Date.now();
  const scheduledAt = Math.max(now, nextRequestAt.get(host) ?? now);
  nextRequestAt.set(host, scheduledAt + Math.max(0, minDelayMs));
  if (scheduledAt > now)
    await new Promise((resolve) => setTimeout(resolve, scheduledAt - now));
}
