import { expect, test } from "vitest";
import { returnTo } from "./return-to";

test("keeps a path on this site with its query", () => {
  expect(returnTo("/device?user_code=ABCD-EFGH")).toBe(
    "/device?user_code=ABCD-EFGH",
  );
});

test.each([
  undefined,
  ["/device"],
  "",
  "device",
  "https://evil.example/",
  "//evil.example/",
  "/\\evil.example/",
  "javascript:alert(1)",
])("falls back to / for %j", (next) => {
  expect(returnTo(next)).toBe("/");
});
