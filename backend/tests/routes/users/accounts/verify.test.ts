/**
 * backend/tests/routes/users/accounts/verify.test.ts
 * Tests for src/routes/users/accounts/verify.route.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import { v7 as uuidv7 } from "uuid";

describe("GET /accounts/verify (without mocking isValidUUIDv7)", () => {
	let fastify: ReturnType<typeof Fastify>;
	let mocks: {
		auth: any;
		main: any;
	};

	const TEST_TOKEN = "fixed_test_token";
	let STORED_BASE64: string;

	beforeEach(async () => {
		vi.resetModules();
		vi.restoreAllMocks();

		// --- Don't mock utils/crypto: we want the real encryptSecret/decryptSecret pair ---
		const cryptoUtils = await import("../../../../src/utils/crypto.js");
		STORED_BASE64 = (cryptoUtils.encryptSecret(TEST_TOKEN) as Buffer).toString("base64");

		// Mock auth wrappers (DB)
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

		// Import route AFTER mocks are registered
		const mod = await import("../../../../src/routes/users/accounts/verify.route.js");
		const { verifyUserAccountRoutes } = mod;

		fastify = Fastify();
		fastify.register(verifyUserAccountRoutes);
		await fastify.ready();

		// import mocks so we can inspect them
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
		const res1 = await fastify.inject({ method: "GET", url: "/accounts/verify" });
		expect(res1.statusCode).toBe(400);
		expect(res1.payload).toContain("Missing token or user id");

		const res2 = await fastify.inject({ method: "GET", url: `/accounts/verify?token=${encodeURIComponent(TEST_TOKEN)}` });
		expect(res2.statusCode).toBe(400);
		expect(res2.payload).toContain("Missing token or user id");
	});

	it("returns 400 when user id invalid", async () => {
		const res = await fastify.inject({ method: "GET", url: `/accounts/verify?user=invalid-uuid&token=${encodeURIComponent(TEST_TOKEN)}` });
		expect(res.statusCode).toBe(400);
		expect(res.payload).toContain("Invalid user id");
	});

	it("returns 404 when no records for user", async () => {
		(mocks.auth.getEmailVerificationsByUserId as any).mockReturnValue([]);
		const validUuid = uuidv7();
		const res = await fastify.inject({ method: "GET", url: `/accounts/verify?user=${validUuid}&token=${encodeURIComponent(TEST_TOKEN)}` });
		expect(res.statusCode).toBe(404);
		expect(res.payload).toContain("Verification record not found");
	});

	it("returns 404 when decrypt doesn't match any record", async () => {
		const validUuid = uuidv7();
		// record exists but token decrypts to something else
		(mocks.auth.getEmailVerificationsByUserId as any).mockReturnValue([
			{ id: 1, user_id: validUuid, token: (Buffer.from("other_token").toString("base64")), expires_at: Date.now() + 10000 },
		]);
		const res = await fastify.inject({ method: "GET", url: `/accounts/verify?user=${validUuid}&token=${encodeURIComponent(TEST_TOKEN)}` });
		expect(res.statusCode).toBe(404);
		expect(res.payload).toContain("Verification record not found");
	});

	it("returns 400 when token is expired", async () => {
		const validUuid = uuidv7();
		// store an encrypted token (created above) but expired
		(mocks.auth.getEmailVerificationsByUserId as any).mockReturnValue([
			{ id: 2, user_id: validUuid, token: STORED_BASE64, expires_at: Date.now() - 1000 },
		]);
		const res = await fastify.inject({ method: "GET", url: `/accounts/verify?user=${validUuid}&token=${encodeURIComponent(TEST_TOKEN)}` });
		// now the route should find the record, decrypt it, match, then return expired (400)
		expect(res.statusCode).toBe(400);
		expect(res.payload).toContain("Verification token has expired");
	});

	it("verifies successfully and updates role", async () => {
		const validUuid = uuidv7();
		const rec = { id: 3, user_id: validUuid, token: STORED_BASE64, expires_at: Date.now() + 10000 };
		(mocks.auth.getEmailVerificationsByUserId as any).mockReturnValue([rec]);

		const res = await fastify.inject({ method: "GET", url: `/accounts/verify?user=${validUuid}&token=${encodeURIComponent(TEST_TOKEN)}` });
		expect(res.statusCode).toBe(200);
		expect(res.payload).toContain("Email verified successfully");

		// markEmailAsVerified called with stored token
		expect((mocks.auth.markEmailAsVerified as any)).toHaveBeenCalled();
		// updateUserRole called with correct user_id and role_id from getRoleByName
		expect((mocks.main.updateUserRole as any)).toHaveBeenCalledWith(validUuid, 2);
	});

	it("returns 500 when markEmailAsVerified throws", async () => {
		const validUuid = uuidv7();
		const rec = { id: 4, user_id: validUuid, token: STORED_BASE64, expires_at: Date.now() + 10000 };
		(mocks.auth.getEmailVerificationsByUserId as any).mockReturnValue([rec]);

		(mocks.auth.markEmailAsVerified as any).mockImplementation(() => { throw new Error("db fail"); });

		const res = await fastify.inject({ method: "GET", url: `/accounts/verify?user=${validUuid}&token=${encodeURIComponent(TEST_TOKEN)}` });
		expect(res.statusCode).toBe(500);
		expect(res.payload).toContain("Failed to verify email");
	});
});