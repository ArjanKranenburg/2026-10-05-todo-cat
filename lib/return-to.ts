const ORIGIN = "http://todo-cat.invalid";

/**
 * Where to send the user after signing in, from an untrusted `next` value: a
 * path on this site, or `/`. Rejects absolute and protocol-relative URLs, so
 * the sign-in form cannot be used to redirect to another site.
 */
export function returnTo(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/")) return "/";
  const url = new URL(next, ORIGIN);
  if (url.origin !== ORIGIN) return "/";
  return `${url.pathname}${url.search}${url.hash}`;
}
