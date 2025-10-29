/**
 * backend/tests/routes/users/accounts/verify.test.ts
 * Tests for src/routes/users/accounts/verify.route.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";

describe("GET /accounts/verify", () => {
	let fastify: ReturnType<typeof Fastify>;
	let mocks: {
		auth: any;
		main: any;
		crypto: any;
	};

	const TEST_TOKEN = "fixed_test_token";
	const STORED_BASE64 = Buffer.from(TEST_TOKEN, "utf8").toString("base64"); // what we store in DB

	beforeEach(async () => {
		vi.resetModules();
		vi.restoreAllMocks();

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

		// Mock crypto utils (decryptSecret)
		vi.doMock("../../../../src/utils/crypto.js", () => ({
			__esModule: true,
			// decryptSecret should accept Buffer and return original plaintext
			decryptSecret: vi.fn((buf: Buffer | string) => {
				if (typeof buf === "string") {
					// if accidentally passed a base64 string
					return Buffer.from(buf, "base64").toString("utf8");
				}
				return buf.toString("utf8");
			}),
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
		const crypto = await import("../../../../src/utils/crypto.js");

		mocks = { auth, main, crypto };
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
		const res = await fastify.inject({ method: "GET", url: `/accounts/verify?user=abc&token=${encodeURIComponent(TEST_TOKEN)}` });
		expect(res.statusCode).toBe(400);
		expect(res.payload).toContain("Invalid user id");
	});

	it("returns 404 when no records for user", async () => {
		(mocks.auth.getEmailVerificationsByUserId as any).mockReturnValue([]);
		const res = await fastify.inject({ method: "GET", url: `/accounts/verify?user=1&token=${encodeURIComponent(TEST_TOKEN)}` });
		expect(res.statusCode).toBe(404);
		expect(res.payload).toContain("Verification record not found");
	});

	it("returns 404 when decrypt doesn't match any record", async () => {
		// record exists but with different token
		(mocks.auth.getEmailVerificationsByUserId as any).mockReturnValue([
			{ id: 7, user_id: 1, token: Buffer.from("other_token").toString("base64"), expires_at: Date.now() + 10000 },
		]);
		const res = await fastify.inject({ method: "GET", url: `/accounts/verify?user=1&token=${encodeURIComponent(TEST_TOKEN)}` });
		expect(res.statusCode).toBe(404);
		expect(res.payload).toContain("Verification record not found");
	});

	it("returns 400 when token is expired", async () => {
		// record present and decrypt matches but expired
		(mocks.auth.getEmailVerificationsByUserId as any).mockReturnValue([
			{ id: 8, user_id: 1, token: STORED_BASE64, expires_at: Date.now() - 1000 },
		]);
		const res = await fastify.inject({ method: "GET", url: `/accounts/verify?user=1&token=${encodeURIComponent(TEST_TOKEN)}` });
		expect(res.statusCode).toBe(400);
		expect(res.payload).toContain("Verification token has expired");
	});

	it("verifies successfully and updates role", async () => {
		// good record
		const rec = { id: 9, user_id: 1, token: STORED_BASE64, expires_at: Date.now() + 10000 };
		(mocks.auth.getEmailVerificationsByUserId as any).mockReturnValue([rec]);

		const res = await fastify.inject({ method: "GET", url: `/accounts/verify?user=1&token=${encodeURIComponent(TEST_TOKEN)}` });
		expect(res.statusCode).toBe(200);
		expect(res.payload).toContain("Email verified successfully");

		// markEmailAsVerified called with stored token
		expect((mocks.auth.markEmailAsVerified as any)).toHaveBeenCalled();
		// updateUserRole called with correct user_id and role_id from getRoleByName
		expect((mocks.main.updateUserRole as any)).toHaveBeenCalledWith(1, 2);
	});

	it("returns 500 when markEmailAsVerified throws", async () => {
		const rec = { id: 10, user_id: 1, token: STORED_BASE64, expires_at: Date.now() + 10000 };
		(mocks.auth.getEmailVerificationsByUserId as any).mockReturnValue([rec]);

		(mocks.auth.markEmailAsVerified as any).mockImplementation(() => { throw new Error("db fail"); });

		const res = await fastify.inject({ method: "GET", url: `/accounts/verify?user=1&token=${encodeURIComponent(TEST_TOKEN)}` });
		expect(res.statusCode).toBe(500);
		expect(res.payload).toContain("Failed to verify email");
	});
});
