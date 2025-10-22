/**
 * tests/routes/oauth/google.test.ts
 * Corrected: properly mocks node-fetch so the route sees the mocked responses.
 */

import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";
import Fastify from "fastify";
import cookie from "@fastify/cookie";

// mock modules used by the route before importing it
vi.mock("../../../src/db/wrappers/auth/oauthProviders.js", () => ({
  getOauthProviderByName: vi.fn(),
}));
vi.mock("../../../src/utils/crypto.js", () => ({
  decryptSecret: vi.fn(),
}));
vi.mock("../../../src/utils/session.js", () => ({
  createNewSession: vi.fn(),
}));
vi.mock("../../../src/db/wrappers/auth/oauthAccounts.js", () => ({
  getOauthAccountByProviderAndUserId: vi.fn(),
}));
vi.mock("../../../src/db/wrappers/main/users.js", () => ({
  getUserByEmail: vi.fn(),
}));

// --- mock node-fetch so imports in the route pick it up ---
vi.mock("node-fetch", () => ({
  default: vi.fn(),
}));

// Now import the route (after mocks)
import { routes } from "../../../src/routes/oauth/forty-two.js";

describe("42 OAuth routes", () => {
    let fastify: ReturnType<typeof Fastify>;
    let nodeFetchMock: Mock;
    let mocks: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        // ensure fresh module state if necessary
        vi.resetModules();
    
        // fastify instance and cookie plugin (so setCookie works)
        fastify = Fastify();
        fastify.register(cookie);
        fastify.register(routes);
    
        // get the node-fetch mock we created above
        const nodeFetch = await import("node-fetch");
        nodeFetchMock = nodeFetch.default as Mock;
    
        // import the other mocked functions (they are vi.fn() thanks to vi.mock)
        mocks = {
            getOauthProviderByName: (await import("../../../src/db/wrappers/auth/oauthProviders.js")).getOauthProviderByName,
            decryptSecret: (await import("../../../src/utils/crypto.js")).decryptSecret,
            createNewSession: (await import("../../../src/utils/session.js")).createNewSession,
            getOauthAccountByProviderAndUserId: (await import("../../../src/db/wrappers/auth/oauthAccounts.js")).getOauthAccountByProviderAndUserId,
            getUserByEmail: (await import("../../../src/db/wrappers/main/users.js")).getUserByEmail,
        };
    });

    afterEach(async () => {
        try { await fastify.close(); } catch {}
        vi.resetAllMocks();
        vi.restoreAllMocks();
    });

    it("redirects to 42 OAuth URL", async () => {
        mocks.getOauthProviderByName.mockReturnValue({
            client_id: "mock-client-id",
            discovery_url: "http://localhost/callback"
        });

        const res = await fastify.inject({ method: "GET", url: "/forty-two" });

        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toContain("https://api.intra.42.fr/oauth/authorize?");
        expect(res.headers.location).toContain("client_id=mock-client-id");
    });

    it("returns 400 if callback is missing code", async () => {
        const res = await fastify.inject({ method: "GET", url: "/forty-two/callback" });

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

        // token endpoint -> returns access_token
        nodeFetchMock
        .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ access_token: "mock-token" }),
        })
        // userinfo endpoint -> returns user info
        .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ id: "forty_two123", email: "u@e.com", name: "User" }),
        });

        mocks.getOauthAccountByProviderAndUserId.mockReturnValue({ user_id: 42 });
        mocks.createNewSession.mockReturnValue({ token: "tok", session: { id: 1 } });

        const res = await fastify.inject({
        method: "GET",
        url: "/forty-two/callback?code=mock-code",
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
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "mock-token" }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "forty_two123", email: "user@example.com", name: "Exist" }) });

        mocks.getOauthAccountByProviderAndUserId.mockReturnValue(undefined);
        mocks.getUserByEmail.mockReturnValue({ id: 99, email: "user@example.com" });

        const res = await fastify.inject({ method: "GET", url: "/forty-two/callback?code=mock-code" });

        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toContain("/auth/link-account?");
    });

    it("redirects to new-account when user didn't exists", async () => {
        mocks.getOauthProviderByName.mockReturnValue({
        client_id: "mock-client-id",
        client_secret_encrypted: "encrypted",
        discovery_url: "http://localhost/callback",
        });
        mocks.decryptSecret.mockReturnValue("decrypted-secret");

        nodeFetchMock
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "mock-token" }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "forty_two123", email: "user@example.com", name: "Exist" }) });

        mocks.getOauthAccountByProviderAndUserId.mockReturnValue(undefined);
        mocks.getUserByEmail.mockReturnValue(undefined);

        const res = await fastify.inject({ method: "GET", url: "/forty-two/callback?code=mock-code" });

        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toContain("/auth/new-account?");
    });

    it("returns 500 if token response misses access_token", async () => {
        mocks.getOauthProviderByName.mockReturnValue({
        client_id: "mock-client-id",
        client_secret_encrypted: "encrypted",
        discovery_url: "http://localhost/callback",
        });
        mocks.decryptSecret.mockReturnValue("decrypted-secret");

        nodeFetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

        const res = await fastify.inject({ method: "GET", url: "/forty-two/callback?code=mock-code" });

        expect(res.statusCode).toBe(500);
        const body = JSON.parse(res.body);
        expect(body.error).toMatch(/No access token/);
    });

    // TODO ADD MANUALY
    it("returns 404 if callback is OAuth provider not found", async () => {
        mocks.getOauthProviderByName.mockReturnValue(undefined);

        const res = await fastify.inject({ method: "GET", url: "/forty-two/callback?code=mock-code" });

        expect(res.statusCode).toBe(404);
        expect(res.body).toContain("OAuth provider not found");
    });

    // TODO ADD MANUALY
    it("returns 404 if 42 is OAuth provider not found", async () => {
        mocks.getOauthProviderByName.mockReturnValue(undefined);

        const res = await fastify.inject({ method: "GET", url: "/forty-two" });

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
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "forty_two123", email: "u@e.com", name: "User" }) });

        mocks.getOauthAccountByProviderAndUserId.mockReturnValue({ user_id: 42 });
        mocks.createNewSession.mockReturnValue(undefined);

        const res = await fastify.inject({
            method: "GET",
            url: "/forty-two/callback?code=mock-code",
            headers: { "user-agent": "test-agent" },
        });

        expect(res.statusCode).toBe(500);
        const body = JSON.parse(res.body);
        expect(body).toEqual({ error: "Failed to create session" });
    });
});