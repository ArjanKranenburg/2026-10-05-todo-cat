import { describe, expect, test } from "vitest";
import { MAX_TITLE_LENGTH, normalizeTitle } from "./title";

describe("normalizeTitle", () => {
  test("trims and collapses whitespace", () => {
    expect(normalizeTitle("  feed \t the\n cat  ")).toBe("feed the cat");
  });

  test("rejects a blank title", () => {
    expect(() => normalizeTitle("   ")).toThrow(RangeError);
  });

  test("accepts the maximum length and rejects one more", () => {
    expect(normalizeTitle("a".repeat(MAX_TITLE_LENGTH))).toHaveLength(
      MAX_TITLE_LENGTH,
    );
    expect(() => normalizeTitle("a".repeat(MAX_TITLE_LENGTH + 1))).toThrow(
      RangeError,
    );
  });
});
