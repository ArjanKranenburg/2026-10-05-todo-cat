export const MAX_TITLE_LENGTH = 200;

/** Trims a to-do title and collapses inner whitespace; rejects empty or overlong titles. */
export function normalizeTitle(raw: string): string {
  const title = raw.trim().replace(/\s+/g, " ");
  if (title.length === 0) {
    throw new RangeError("A to-do needs a title.");
  }
  if (title.length > MAX_TITLE_LENGTH) {
    throw new RangeError(
      `A to-do title can have at most ${MAX_TITLE_LENGTH} characters.`,
    );
  }
  return title;
}
