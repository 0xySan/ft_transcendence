/**
 * tests/routes/oauth/github.test.ts
 * Corrected: properly mocks node-fetch so the route sees the mocked responses.
 */

import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";
import Fastify from "fastify";
import cookie from "@fastify/cookie";

// --- mock modules used by the route ---
vi.mock("../../../src/db/wrappers/auth/oauth/oauthProviders.js", () => ({
  getOauthProviderByName: vi.fn(),
}));
vi.mock("../../../src/utils/crypto.js", () => ({
  decryptSecret: vi.fn(),
}));
vi.mock("../../../src/utils/session.js", () => ({
  createNewSession: vi.fn(),
}));
vi.mock("../../../src/db/wrappers/auth/oauth/oauthAccounts.js", () => ({
  getOauthAccountByProviderAndUserId: vi.fn(),
}));
vi.mock("../../../src/db/wrappers/main/users/users.js", () => ({
  getUserByEmail: vi.fn(),
}));

// --- mock node-fetch globally so route picks up the mocked instance ---
vi.mock("node-fetch", () => ({
  default: vi.fn(),
}));

// now import the route (after mocks)
import { githubRoutes } from "../../../src/routes/oauth/github.route.js";

describe("GitHub OAuth route", () => {
  let fastify: ReturnType<typeof Fastify>;
  let nodeFetchMock: Mock;
  let mocks: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    fastify = Fastify();
    fastify.register(cookie);
    fastify.register(githubRoutes);

    const nodeFetch = await import("node-fetch");
    nodeFetchMock = nodeFetch.default as Mock;
    mocks = {
      getOauthProviderByName: (await import("../../../src/db/wrappers/auth/oauth/oauthProviders.js")).getOauthProviderByName,
      decryptSecret: (await import("../../../src/utils/crypto.js")).decryptSecret,
      createNewSession: (await import("../../../src/utils/session.js")).createNewSession,
      getOauthAccountByProviderAndUserId: (await import("../../../src/db/wrappers/auth/oauth/oauthAccounts.js")).getOauthAccountByProviderAndUserId,
      getUserByEmail: (await import("../../../src/db/wrappers/main/users/users.js")).getUserByEmail,
    };
  });

  afterEach(async () => {
    try {
      await fastify.close();
    } catch {}
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  // ---- TESTS ----
  it("returns 400 if callback is missing code", async () => {
    const res = await fastify.inject({ method: "GET", url: "/github/callback" });

    expect(res.statusCode).toBe(400);
    expect(res.body).toContain("Missing code");
  });

  it("creates session and sets cookie when oauth account exists", async () => {
    mocks.getOauthProviderByName.mockReturnValue({
      client_id: "mock-client-id",
      client_secret_encrypted: "encrypted",
      discovery_url: "http://localhost/callback",
    });
    mocks.decryptSecret.mockReturnValue("decrypted-secret");

    // token endpoint
    nodeFetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "mock-token" }),
      })
      // userinfo endpoint
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "gh123", email: "user@example.com", name: "User" }),
      });

    mocks.getOauthAccountByProviderAndUserId.mockReturnValue({ user_id: 42 });
    mocks.createNewSession.mockReturnValue({ token: "tok", session: { id: 1 } });

    const res = await fastify.inject({
      method: "GET",
      url: "/github/callback?code=mock-code",
      headers: { "user-agent": "test-agent" },
      remoteAddress: "127.0.0.1",
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers["set-cookie"]).toBeDefined();
    expect(res.headers.location).toContain("/auth/success");
    expect(nodeFetchMock).toHaveBeenCalledTimes(2);
  });

  it("redirects to link-account when user exists but no oauth account", async () => {
    mocks.getOauthProviderByName.mockReturnValue({
      client_id: "mock-client-id",
      client_secret_encrypted: "encrypted",
      discovery_url: "http://localhost/callback",
    });
    mocks.decryptSecret.mockReturnValue("decrypted-secret");

    nodeFetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "mock-token" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "gh123", email: "user@example.com", name: "Exist" }),
      });

    mocks.getOauthAccountByProviderAndUserId.mockReturnValue(undefined);
    mocks.getUserByEmail.mockReturnValue({ id: 99, email: "user@example.com" });

    const res = await fastify.inject({ method: "GET", url: "/github/callback?code=mock-code" });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain("/auth/link-account?");
  });

  it("redirects to new-account when no user and no oauth account", async () => {
    mocks.getOauthProviderByName.mockReturnValue({
      client_id: "mock-client-id",
      client_secret_encrypted: "encrypted",
      discovery_url: "http://localhost/callback",
    });
    mocks.decryptSecret.mockReturnValue("decrypted-secret");

    nodeFetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "mock-token" }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "gh123", email: "new@example.com", name: "New" }),
      });

    mocks.getOauthAccountByProviderAndUserId.mockReturnValue(undefined);
    mocks.getUserByEmail.mockReturnValue(undefined);

    const res = await fastify.inject({ method: "GET", url: "/github/callback?code=mock-code" });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain(
      "/register?email=new%40example.com&provider=github&providerId=gh123&name=New&picture="
    );
  });

  it("returns 500 if token response misses access_token", async () => {
    mocks.getOauthProviderByName.mockReturnValue({
      client_id: "mock-client-id",
      client_secret_encrypted: "encrypted",
      discovery_url: "http://localhost/callback",
    });
    mocks.decryptSecret.mockReturnValue("decrypted-secret");

    nodeFetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    const res = await fastify.inject({ method: "GET", url: "/github/callback?code=mock-code" });

    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/No access token/);
  });

  it("GET /github/callback returns 404 when provider is missing", async () => {
    mocks.getOauthProviderByName.mockReturnValue(undefined);

    const res = await fastify.inject({
      method: "GET",
      url: "/github/callback?code=abc",
    });

    expect(res.statusCode).toBe(404);
    expect(res.body).toContain("OAuth provider not found");
  });

  it("returns 500 with proper message if createNewSession fails", async () => {
    mocks.getOauthProviderByName.mockReturnValue({
      client_id: "mock-client-id",
      client_secret_encrypted: "encrypted",
      discovery_url: "http://localhost/callback",
    });
    mocks.decryptSecret.mockReturnValue("decrypted-secret");

    nodeFetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "mock-token" }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "gh123", email: "user@example.com", name: "User" }),
      });

    mocks.getOauthAccountByProviderAndUserId.mockReturnValue({ user_id: 42 });
    mocks.createNewSession.mockReturnValue(undefined);

    const res = await fastify.inject({
      method: "GET",
      url: "/github/callback?code=mock-code",
      headers: { "user-agent": "test-agent" },
    });

    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body);
    expect(body).toEqual({ error: "Failed to create session" });
  });

  it("return 502 if Github server is down" ), async () => {
    mocks.getOauthProviderByName.mockReturnValue({
      client_id: "mock-client-id",
      client_secret_encrypted: "encrypted",
      discovery_url: "http://localhost/callback"
    })

    mocks.decryptSecret.mockReturnValue("decrypted-secret");
    nodeFetchMock.mockRejectedValueOnce({ ok: true });
    json: async () => ({ access_token: "mock-token" });
    const res = await fastify.inject({ method: "GET", url: "/github/callback?code=mock-code" });
    
    expect(res.statusCode).toBe(502);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/GitHub server is down/);
  }
});
