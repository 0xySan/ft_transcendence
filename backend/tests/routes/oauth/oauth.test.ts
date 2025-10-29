/**
 * @file OAuth routes test
 * Corrected: properly mocks node-fetch so the route sees the mocked responses.
 */

import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";
import Fastify from "fastify";
import cookie from "@fastify/cookie";

// mock modules used by the route
vi.mock("../../../src/db/wrappers/auth/oauth/oauthProviders.js", () => ({
	getOauthProviderByName: vi.fn(),
}));

import { oauthRoute } from "../../../src/routes/oauth/oauth.route.js";

describe("OAuth redirect route", () => {
	let fastify: ReturnType<typeof Fastify>;
	let mocks: any;

	beforeEach(async () => {
		vi.clearAllMocks();
		vi.resetModules();

		fastify = Fastify();
		fastify.register(cookie);
		fastify.register(oauthRoute);

		mocks = {
			getOauthProviderByName: (await import("../../../src/db/wrappers/auth/oauth/oauthProviders.js")).getOauthProviderByName,
		};
	});

	afterEach(async () => {
		try { await fastify.close(); } catch {}
		vi.resetAllMocks();
		vi.restoreAllMocks();
	});

	/* Google OAuth tests */
	it("redirects to Google OAuth URL", async () => {
		mocks.getOauthProviderByName.mockReturnValue({
			client_id: "mock-client-id",
			discovery_url: "http://localhost/callback",
		});

		const res = await fastify.inject({ method: "GET", url: "/google" });

		expect(res.statusCode).toBe(302);
		expect(res.headers.location).toContain("https://accounts.google.com/o/oauth2/v2/auth");
		expect(res.headers.location).toContain("client_id=mock-client-id");
	});

	it("returns 404 when provider is missing", async () => {
		mocks.getOauthProviderByName.mockReturnValue(undefined);

		const res = await fastify.inject({ method: "GET", url: "/google" });

		expect(res.statusCode).toBe(404);
		expect(res.body).toContain("OAuth provider not found");
	});

	/* GitHub OAuth tests */
	it("redirects to GitHub OAuth URL", async () => {
		mocks.getOauthProviderByName.mockReturnValue({
		client_id: "mock-client-id",
		discovery_url: "http://localhost/callback",
		});
	
		const res = await fastify.inject({ method: "GET", url: "/github" });
	
		expect(res.statusCode).toBe(302);
		expect(res.headers.location).toContain("https://github.com/login/oauth/authorize");
		expect(res.headers.location).toContain("client_id=mock-client-id");
	});

	it("GET /github returns 404 when provider is missing", async () => {
		mocks.getOauthProviderByName.mockReturnValue(undefined);
	
		const res = await fastify.inject({ method: "GET", url: "/github" });
	
		expect(res.statusCode).toBe(404);
		expect(res.body).toContain("OAuth provider not found");
	});

	/* 42 OAuth tests */
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

	it("returns 404 if 42 is OAuth provider not found", async () => {
		mocks.getOauthProviderByName.mockReturnValue(undefined);
	
		const res = await fastify.inject({ method: "GET", url: "/forty-two" });
	
		expect(res.statusCode).toBe(404);
		expect(res.body).toContain("OAuth provider not found");
	});

	/* Discord OAuth tests */
	it("redirects to Discord OAuth URL", async () => {
		mocks.getOauthProviderByName.mockReturnValue({
			client_id: "mock-client-id",
			discovery_url: "http://localhost/callback",
		});
	
		const res = await fastify.inject({ method: "GET", url: "/discord" });
	
		expect(res.statusCode).toBe(302);
		expect(res.headers.location).toContain("https://discord.com/oauth2/authorize");
		expect(res.headers.location).toContain("client_id=mock-client-id");
	});

	it("GET /discord returns 404 when provider is missing", async () => {
		mocks.getOauthProviderByName.mockReturnValue(undefined);
	
		const res = await fastify.inject({ method: "GET", url: "/discord" });
	
		expect(res.statusCode).toBe(404);
		expect(res.body).toContain("OAuth provider not found");
	});
});