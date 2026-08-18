export function parseRetryAfterMs(
  value: string | null,
  now = Date.now(),
): number | null {
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds * 1000);
  }

  const retryAt = Date.parse(value);
  if (Number.isNaN(retryAt)) return null;

  return Math.max(0, retryAt - now);
}
