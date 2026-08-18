import { describe, expect, test } from "bun:test";

import { parseRetryAfterMs } from "../utils/http";

describe("parseRetryAfterMs", () => {
  test("parses delta seconds", () => {
    expect(parseRetryAfterMs("2.5", 0)).toBe(2500);
  });

  test("parses HTTP dates", () => {
    const now = Date.parse("2026-08-18T17:00:00Z");
    expect(parseRetryAfterMs("Tue, 18 Aug 2026 17:00:10 GMT", now)).toBe(
      10_000,
    );
  });

  test("clamps past HTTP dates to zero", () => {
    const now = Date.parse("2026-08-18T17:00:10Z");
    expect(parseRetryAfterMs("Tue, 18 Aug 2026 17:00:00 GMT", now)).toBe(0);
  });

  test("rejects missing, invalid, and negative values", () => {
    expect(parseRetryAfterMs(null, 0)).toBe(null);
    expect(parseRetryAfterMs("nonsense", 0)).toBe(null);
    expect(parseRetryAfterMs("-1", 0)).toBe(null);
  });
});
