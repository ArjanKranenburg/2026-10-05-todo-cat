import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { betterAuth } from "better-auth";
import { type TestHelpers, testUtils } from "better-auth/plugins";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
  vi,
} from "vitest";

const dir = mkdtempSync(join(tmpdir(), "todo-cat-auth-test-"));
const url = `file:${join(dir, "test.db")}`;

// Test-only instance: the app's options plus testUtils(), on the same database
// and secret as lib/auth.ts, so sessions it creates are valid for getUserId.
function createTestAuth(
  options: ReturnType<typeof import("./auth-options")["authOptions"]>,
) {
  return betterAuth({ ...options, plugins: [...options.plugins, testUtils()] });
}

let db: typeof import("./db")["db"];
let auth: ReturnType<typeof createTestAuth>;
let helpers: TestHelpers;
let getUserId: typeof import("./session")["getUserId"];

beforeAll(async () => {
  // Same command as `npm run db:migrate`; the env var wins over .env.
  execFileSync("npm", ["run", "--silent", "db:migrate"], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
  vi.stubEnv("DATABASE_URL", url);
  vi.stubEnv(
    "BETTER_AUTH_SECRET",
    "test-secret-that-is-at-least-32-characters",
  );
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  vi.stubEnv("GOOGLE_CLIENT_ID", "test-google-client-id");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-google-client-secret");
  ({ db } = await import("./db"));
  const { authOptions } = await import("./auth-options");
  auth = createTestAuth(authOptions(db));
  helpers = (await auth.$context).test;
  ({ getUserId } = await import("./session"));
}, 60_000);

afterAll(() => {
  db?.$client.close();
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

describe("email and password", () => {
  const credentials = { email: "lissie@example.com", password: "tuna-o-clock" };

  test("sign-up creates the user", async () => {
    const result = await auth.api.signUpEmail({
      body: { name: "Lissie", ...credentials },
    });

    expect(result.user).toMatchObject({
      name: "Lissie",
      email: credentials.email,
    });
  });

  test("the right password signs in", async () => {
    const result = await auth.api.signInEmail({ body: credentials });

    expect(result.user.email).toBe(credentials.email);
    expect(result.token).toEqual(expect.any(String));
  });

  test("a wrong password is rejected", async () => {
    await expect(
      auth.api.signInEmail({
        body: { ...credentials, password: "not-the-tuna" },
      }),
    ).rejects.toMatchObject({ status: "UNAUTHORIZED" });
  });
});

describe("getUserId", () => {
  let userId: string;

  beforeAll(async () => {
    userId = (await helpers.saveUser(helpers.createUser())).id;
  });

  test("returns the user id for a session cookie", async () => {
    const headers = await helpers.getAuthHeaders({ userId });

    expect(headers.get("cookie")).toContain("session_token");
    expect(await getUserId(headers)).toBe(userId);
  });

  test("returns the user id for a bearer token", async () => {
    const { token } = await helpers.login({ userId });
    const headers = new Headers({ authorization: `Bearer ${token}` });

    expect(await getUserId(headers)).toBe(userId);
  });

  test("returns null without a cookie or token", async () => {
    expect(await getUserId(new Headers())).toBeNull();
  });

  test("returns null for an unknown bearer token", async () => {
    const headers = new Headers({ authorization: "Bearer not-a-session" });

    expect(await getUserId(headers)).toBeNull();
  });
});

describe("Google sign-in", () => {
  // Google's provider decodes the id token from its token endpoint without
  // checking the signature, so an unsigned token stands in for Google's.
  function idToken(claims: Record<string, unknown>) {
    const part = (value: object) =>
      Buffer.from(JSON.stringify(value)).toString("base64url");
    return `${part({ alg: "RS256", typ: "JWT" })}.${part({
      iss: "https://accounts.google.com",
      aud: "test-google-client-id",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      email_verified: true,
      ...claims,
    })}.signature`;
  }

  // Stands in for Google's token endpoint; any other outgoing request fails the test.
  function stubGoogleTokenEndpoint(claims: Record<string, unknown>) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = input instanceof Request ? input.url : String(input);
        if (!url.startsWith("https://oauth2.googleapis.com/token")) {
          throw new Error(`Unexpected request to ${url}`);
        }
        return Response.json({
          access_token: "google-access-token",
          token_type: "Bearer",
          expires_in: 3600,
          scope: "openid email profile",
          id_token: idToken(claims),
        });
      }),
    );
  }

  // The same call as signInWithGoogle in app/auth-actions.ts.
  async function startSignIn() {
    const { headers, response } = await auth.api.signInSocial({
      body: {
        provider: "google",
        callbackURL: "/",
        errorCallbackURL: "/login",
      },
      returnHeaders: true,
    });
    return { url: new URL(response.url ?? ""), cookie: cookieHeader(headers) };
  }

  // What the browser does when Google redirects back with a code.
  function callback(state: string, cookie: string) {
    const url = new URL("http://localhost:3000/api/auth/callback/google");
    url.search = new URLSearchParams({ code: "google-code", state }).toString();
    return auth.handler(new Request(url, { headers: { cookie } }));
  }

  function cookieHeader(headers: Headers) {
    return headers
      .getSetCookie()
      .map((cookie) => cookie.split(";")[0])
      .join("; ");
  }

  function redirectTarget(response: Response) {
    const location = response.headers.get("location") ?? "";
    const url = new URL(location, "http://localhost:3000");
    return `${url.pathname}${url.search}`;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("sign-in starts at Google's consent screen", async () => {
    const { url } = await startSignIn();

    expect(url.origin + url.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: "test-google-client-id",
      redirect_uri: "http://localhost:3000/api/auth/callback/google",
      response_type: "code",
      code_challenge_method: "S256",
      state: expect.any(String),
    });
    expect(url.searchParams.get("scope")?.split(" ")).toEqual(
      expect.arrayContaining(["openid", "email", "profile"]),
    );
  });

  test("the callback creates the user and signs them in", async () => {
    stubGoogleTokenEndpoint({
      sub: "google-user-1",
      email: "mittens@example.com",
      name: "Mittens",
    });
    const { url, cookie } = await startSignIn();

    const response = await callback(
      url.searchParams.get("state") ?? "",
      cookie,
    );

    expect(response.status).toBe(302);
    expect(redirectTarget(response)).toBe("/");
    const userId = await getUserId(
      new Headers({ cookie: cookieHeader(response.headers) }),
    );
    const user = await db.query.user.findFirst({
      where: { id: userId ?? "" },
      with: { accounts: true },
    });
    expect(user).toMatchObject({
      name: "Mittens",
      email: "mittens@example.com",
      emailVerified: true,
      accounts: [{ providerId: "google", accountId: "google-user-1" }],
    });
  });

  test("an unverified password account with the same email is not taken over", async () => {
    // Better Auth links only when the local email is verified, so whoever
    // signed up with the password cannot later reach the Google user's session.
    await auth.api.signUpEmail({
      body: {
        name: "Not Whiskers",
        email: "whiskers@example.com",
        password: "tuna-o-clock",
      },
    });
    stubGoogleTokenEndpoint({
      sub: "google-user-2",
      email: "whiskers@example.com",
      name: "Whiskers",
    });
    const { url, cookie } = await startSignIn();

    const response = await callback(
      url.searchParams.get("state") ?? "",
      cookie,
    );

    expect(redirectTarget(response)).toBe("/login?error=account_not_linked");
    expect(cookieHeader(response.headers)).not.toContain("session_token");
  });
});
