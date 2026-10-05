import { expect, test } from "vitest";
import { formatUserCode } from "./auth";

test("formatUserCode splits the default 8-character code", () => {
  expect(formatUserCode("ABCDEFGH")).toBe("ABCD-EFGH");
  expect(formatUserCode("abcd efgh")).toBe("ABCD-EFGH");
});

test("formatUserCode leaves other lengths alone", () => {
  expect(formatUserCode("ABC")).toBe("ABC");
});
