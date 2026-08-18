export function parseRetryAfterMs(
  value: string | null,
  now = Date.now(),
): number | null {
  if (!value?.trim()) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return seconds >= 0 ? Math.ceil(seconds * 1000) : null;
  }

  const retryAt = Date.parse(value);
  if (Number.isNaN(retryAt)) return null;

  return Math.max(0, retryAt - now);
}
