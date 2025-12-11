/**
 * backend/tests/routes/users/accounts/verify.test.ts
 * Tests for src/routes/users/accounts/verify.route.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import { v7 as uuidv7 } from "uuid";

describe("POST /accounts/verify (Argon2 + rate limit + timing)", () => {
	let fastify: ReturnType<typeof Fastify>;
	let mocks: {
		auth: any;
		main: any;
	};
	const TEST_TOKEN = "fixed_test_token";
	let STORED_HASH: string;

	beforeEach(async () => {
		vi.resetModules();
		vi.restoreAllMocks();

		// --- Prepare a real Argon2 hash for TEST_TOKEN (use real crypto utils) ---
		const cryptoUtils = await import("../../../../src/utils/crypto.js");
		STORED_HASH = await cryptoUtils.hashString(TEST_TOKEN);

		// --- Mock utils/security to avoid waiting during tests and provide deterministic rate limiting ---
		vi.doMock("../../../../src/utils/security.js", () => ({
			__esModule: true,
			// A simple test-friendly checkRateLimit that mirrors the behaviour used by the route.
			checkRateLimit: (_requestCount: any, _ip: string, _reply: any) => true,
			// Make delayResponse a no-op in tests to speed them up
			delayResponse: async () => {},
		}));

		// Mock auth wrappers (DB access)
		vi.doMock("../../../../src/db/wrappers/auth/index.js", () => ({
			__esModule: true,
			getEmailVerificationsByUserId: vi.fn(),
			markEmailAsVerified: vi.fn(),
		}));

		// Mock main wrappers
		vi.doMock("../../../../src/db/wrappers/main/index.js", () => ({
			__esModule: true,
			getRoleByName: vi.fn().mockReturnValue({ role_id: 2, role_name: "user" }),
			updateUserRole: vi.fn(),
		}));

		// Import and register route AFTER mocks are in place
		const mod = await import("../../../../src/routes/users/accounts/verify.route.js");
		const { verifyUserAccountRoutes } = mod;

		fastify = Fastify();
		fastify.register(verifyUserAccountRoutes);
		await fastify.ready();

		// import mocks so we can inspect calls
		const auth = await import("../../../../src/db/wrappers/auth/index.js");
		const main = await import("../../../../src/db/wrappers/main/index.js");

		mocks = { auth, main };
	});

	afterEach(async () => {
		try { await fastify.close(); } catch (_) {}
		vi.resetAllMocks();
		vi.restoreAllMocks();
	});

	it("returns 400 when token or user missing", async () => {
		const res1 = await fastify.inject({ method: "POST", url: "/accounts/verify", payload: {} });
		expect(res1.statusCode).toBe(400);
		expect(res1.payload).toContain("Missing token or user id");

		const res2 = await fastify.inject({ method: "POST", url: "/accounts/verify", payload: { token: TEST_TOKEN } });
		expect(res2.statusCode).toBe(400);
		expect(res2.payload).toContain("Missing token or user id");
	});

	it("returns 400 when user id invalid", async () => {
		const res = await fastify.inject({ method: "POST", url: "/accounts/verify", payload: { user: "invalid-uuid", token: TEST_TOKEN } });
		expect(res.statusCode).toBe(400);
		expect(res.payload).toContain("Invalid user id");
	});

	it("returns generic 202 when no records for user", async () => {
		(mocks.auth.getEmailVerificationsByUserId as any).mockReturnValue([]);
		const validUuid = uuidv7();
		const res = await fastify.inject({ method: "POST", url: "/accounts/verify", payload: { user: validUuid, token: TEST_TOKEN } });
		expect(res.statusCode).toBe(202);
		expect(res.json()).toHaveProperty("message");
	});

	it("returns generic 202 when token does not match any record", async () => {
		const validUuid = uuidv7();
		// record exists but token hash is for a different token
		const otherHash = await (await import("../../../../src/utils/crypto.js")).hashString("other_token");
		(mocks.auth.getEmailVerificationsByUserId as any).mockReturnValue([
			{ id: 1, user_id: validUuid, token: otherHash, expires_at: Date.now() + 10000 },
		]);
		const res = await fastify.inject({ method: "POST", url: "/accounts/verify", payload: { user: validUuid, token: TEST_TOKEN } });
		expect(res.statusCode).toBe(202);
		expect(mocks.auth.markEmailAsVerified).not.toHaveBeenCalled();
	});

	it("returns generic 202 when token matches but is expired", async () => {
		const validUuid = uuidv7();
		(mocks.auth.getEmailVerificationsByUserId as any).mockReturnValue([
			{ id: 2, user_id: validUuid, token: STORED_HASH, expires_at: Date.now() - 1000 },
		]);
		const res = await fastify.inject({ method: "POST", url: "/accounts/verify", payload: { user: validUuid, token: TEST_TOKEN } });
		// route verifies hash, sees expiration, then returns generic 202 (no enumeration)
		expect(res.statusCode).toBe(202);
		expect(mocks.auth.markEmailAsVerified).not.toHaveBeenCalled();
	});

	it("verifies successfully and updates role (calls markEmailAsVerified & updateUserRole)", async () => {
		const validUuid = uuidv7();
		const rec = { id: 3, user_id: validUuid, token: STORED_HASH, expires_at: Date.now() + 10000 };
		(mocks.auth.getEmailVerificationsByUserId as any).mockReturnValue([rec]);

		const res = await fastify.inject({ method: "POST", url: "/accounts/verify", payload: { user: validUuid, token: TEST_TOKEN } });
		// route uses generic response to avoid enumeration, but side-effects must have run
		expect(res.statusCode).toBe(202);
		expect((mocks.auth.markEmailAsVerified as any)).toHaveBeenCalledWith(rec.token);
		expect((mocks.main.updateUserRole as any)).toHaveBeenCalledWith(validUuid, 2);
	});

	it("returns 500 when markEmailAsVerified throws", async () => {
		const validUuid = uuidv7();
		const rec = { id: 4, user_id: validUuid, token: STORED_HASH, expires_at: Date.now() + 10000 };
		(mocks.auth.getEmailVerificationsByUserId as any).mockReturnValue([rec]);
		(mocks.auth.markEmailAsVerified as any).mockImplementation(() => { throw new Error("db fail"); });

		const res = await fastify.inject({ method: "POST", url: "/accounts/verify", payload: { user: validUuid, token: TEST_TOKEN } });
		expect(res.statusCode).toBe(500);
		expect(res.payload).toContain("Failed to verify email");
	});
});
