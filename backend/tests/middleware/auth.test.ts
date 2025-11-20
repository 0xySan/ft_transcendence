/**
 * tests/middleware/auth.test.ts
 * Tests for requireAuth and requirePartialAuth pre-handlers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import cookie from "@fastify/cookie";

// ---- Mock before importing preHandlers ----
vi.mock("../../src/utils/session.js", () => ({
	checkTokenValidity: vi.fn(),
}));

vi.mock("../../src/utils/crypto.js", () => ({
	tokenHash: vi.fn(),
}));

vi.mock("../../src/db/wrappers/auth/index.js", () => ({
	getSessionByTokenHash: vi.fn(),
}));

// Import after mocks
import { requireAuth, requirePartialAuth } from "../../src/middleware/auth.middleware.js";

describe("preHandlers (requireAuth & requirePartialAuth)", () => {
	let fastify: ReturnType<typeof Fastify>;
	let mocks: any;

	beforeEach(async () => {
		vi.clearAllMocks();
		vi.resetModules();

		fastify = Fastify();
		fastify.register(cookie);

		// expose handlers through routes for testing via inject()
		fastify.get("/auth-test", { preHandler: requireAuth }, async () => ({ ok: true }));
		fastify.get("/partial-test", { preHandler: requirePartialAuth }, async () => ({ ok: true }));

		mocks = {
			checkTokenValidity: (await import("../../src/utils/session.js")).checkTokenValidity,
			tokenHash: (await import("../../src/utils/crypto.js")).tokenHash,
			getSessionByTokenHash: (await import("../../src/db/wrappers/auth/index.js")).getSessionByTokenHash,
		};
	});

	afterEach(async () => {
		try {
			await fastify.close();
		} catch {}
		vi.restoreAllMocks();
	});

	// -----------------------------------------------------
	// requireAuth
	// -----------------------------------------------------
	it("requireAuth returns 401 when no token", async () => {
		const res = await fastify.inject({ method: "GET", url: "/auth-test" });
		expect(res.statusCode).toBe(401);
		expect(res.json().message).toMatch(/No session token/);
	});

	it("requireAuth returns 401 when token is invalid", async () => {
		mocks.checkTokenValidity.mockReturnValue({ isValid: false });

		const res = await fastify.inject({
			method: "GET",
			url: "/auth-test",
			cookies: { session: "abc" },
		});

		expect(res.statusCode).toBe(401);
		expect(res.json().message).toMatch(/Invalid or expired session/);
	});

	it("requireAuth attaches session and allows request", async () => {
		mocks.checkTokenValidity.mockReturnValue({
			isValid: true,
			session: { id: 1, user_id: 5 },
		});

		const res = await fastify.inject({
			method: "GET",
			url: "/auth-test",
			headers: { authorization: "Bearer token123" },
		});

		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual({ ok: true });
	});

	// -----------------------------------------------------
	// requirePartialAuth
	// -----------------------------------------------------
	it("requirePartialAuth returns 401 when no token", async () => {
		const res = await fastify.inject({ method: "GET", url: "/partial-test" });
		expect(res.statusCode).toBe(401);
		expect(res.json().message).toMatch(/No session token/);
	});

	it("requirePartialAuth returns 401 when token is invalid", async () => {
		mocks.tokenHash.mockReturnValue("hashed");
		mocks.getSessionByTokenHash.mockReturnValue(undefined);

		const res = await fastify.inject({
			method: "GET",
			url: "/partial-test",
			cookies: { session: "abc" },
		});

		expect(res.statusCode).toBe(401);
		expect(res.json().message).toMatch(/Invalid or expired partial session/);
		});

	it("requirePartialAuth returns 401 when partial session expired", async () => {
		const now = Math.floor(Date.now() / 1000);

		mocks.tokenHash.mockReturnValue("hashed");
		mocks.getSessionByTokenHash.mockReturnValue({
			expires_at: now - 10,
			stage: "partial",
		});

		const res = await fastify.inject({
			method: "GET",
			url: "/partial-test",
			cookies: { session: "abc" },
		});

		expect(res.statusCode).toBe(401);
		expect(res.json().message).toMatch(/Invalid or expired partial session/);
	});

	it("requirePartialAuth returns 401 if session is not in 'partial' stage", async () => {
		const now = Math.floor(Date.now() / 1000);

		mocks.tokenHash.mockReturnValue("hashed");
		mocks.getSessionByTokenHash.mockReturnValue({
			expires_at: now + 1000,
			stage: "full",
		});

		const res = await fastify.inject({
			method: "GET",
			url: "/partial-test",
			cookies: { session: "abc" },
		});

		expect(res.statusCode).toBe(401);
		expect(res.json().message).toMatch(/Invalid or expired partial session/);
	});

	it("requirePartialAuth attaches session and allows request when valid", async () => {
		const now = Math.floor(Date.now() / 1000);

		mocks.tokenHash.mockReturnValue("hashed");
		mocks.getSessionByTokenHash.mockReturnValue({
			expires_at: now + 1000,
			stage: "partial",
			user_id: 42,
		});

		const res = await fastify.inject({
			method: "GET",
			url: "/partial-test",
			cookies: { session: "abc" },
		});

		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual({ ok: true });
	});

	it("requirePartialAuth uses Authorization header if no cookie", async () => {
		const now = Math.floor(Date.now() / 1000);

		mocks.tokenHash.mockReturnValue("hashed");
		mocks.getSessionByTokenHash.mockReturnValue({
			expires_at: now + 1000,
			stage: "partial",
			user_id: 42,
		});

		const res = await fastify.inject({
			method: "GET",
			url: "/partial-test",
			headers: { authorization: "Bearer token123" },
		});

		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual({ ok: true });
	});
});
