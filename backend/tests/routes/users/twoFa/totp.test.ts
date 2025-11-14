/**
 * @file backend/tests/routes/users/twoFa/totp.route.test.ts
 * @description Exhaustive tests for TOTP 2FA routes (validate & token)
 */

import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";
import Fastify from "fastify";
import { v7 as uuidv7 } from "uuid";

vi.mock("../../../../src/middleware/auth.middleware.js", () => ({
	__esModule: true,
	requirePartialAuth: vi.fn((req, reply, done) => {
		(req as any).session = { user_id: "user123", ip: "127.0.0.1" };
		done();
	}),
}));

vi.mock("../../../../src/utils/security.js", () => ({
	__esModule: true,
	checkRateLimit: vi.fn(() => true),
}));

vi.mock("../../../../src/utils/crypto.js", () => ({
	__esModule: true,
	decryptSecret: vi.fn(),
	generateRandomToken: vi.fn(),
	signToken: vi.fn(),
}));

vi.mock("../../../../src/auth/2Fa/totpUtils.js", () => ({
	__esModule: true,
	verifyTotp: vi.fn(),
}));

vi.mock("../../../../src/db/index.js", () => ({
	__esModule: true,
	getUserTotpMethodById: vi.fn(),
	getUser2faTotpByMethodId: vi.fn(),
	verify2FaMethod: vi.fn(),
}));

import { totpRoutes } from "../../../../src/routes/users/twoFa/totp.route.js";
import {
	getUserTotpMethodById,
	getUser2faTotpByMethodId,
	verify2FaMethod,
} from "../../../../src/db/index.js";
import {
	decryptSecret,
	generateRandomToken,
	signToken,
} from "../../../../src/utils/crypto.js";
import { verifyTotp } from "../../../../src/auth/2Fa/totpUtils.js";
import { checkRateLimit } from "../../../../src/utils/security.js";

describe("TOTP 2FA routes", () => {
	let fastify: ReturnType<typeof Fastify>;

	beforeEach(async () => {
		vi.resetAllMocks();
		fastify = Fastify();
		fastify.register(totpRoutes);
		await fastify.ready();
	});

	afterEach(async () => {
		try {
			await fastify.close();
		} catch {}
	});

	// ---------- VALIDATE ROUTE ----------
	describe("POST /twofa/totp/validate", () => {
		it("returns 429 if IP rate limit exceeded", async () => {
			(checkRateLimit as Mock).mockReturnValueOnce(false);
			const res = await fastify.inject({
				method: "POST",
				url: "/twofa/totp/validate",
				payload: { twofa_uuid: uuidv7(), totp_code: "123456" },
			});
			expect(res.statusCode).toBe(429);
		});

		it("returns 400 if body missing", async () => {
			const res = await fastify.inject({
				method: "POST",
				url: "/twofa/totp/validate",
				payload: {},
			});
			expect(res.statusCode).toBe(400);
			expect(JSON.parse(res.body).message).toBe(
				"twofa_uuid and totp_code are required."
			);
		});

		it("returns 400 if invalid format", async () => {
			const res = await fastify.inject({
				method: "POST",
				url: "/twofa/totp/validate",
				payload: { twofa_uuid: uuidv7(), totp_code: "abc" },
			});
			expect(res.statusCode).toBe(400);
			expect(JSON.parse(res.body).message).toBe(
				"Invalid TOTP format. Must be 6–8 digits."
			);
		});

		it("returns 404 if method not found or unauthorized", async () => {
			(getUserTotpMethodById as Mock).mockReturnValue(null);
			const res = await fastify.inject({
				method: "POST",
				url: "/twofa/totp/validate",
				payload: { twofa_uuid: uuidv7(), totp_code: "123456" },
			});
			expect(res.statusCode).toBe(404);
		});

		it("returns 404 if TOTP invalid", async () => {
			const id = uuidv7();
			(getUserTotpMethodById as Mock).mockReturnValue({
				method: { method_id: id, method_type: 1, user_id: "user123", is_verified: true },
				totp: { secret_encrypted: "abcd", secret_meta: "{}" },
			});
			(decryptSecret as Mock).mockReturnValue("secret");
			(verifyTotp as Mock).mockReturnValue(false);

			const res = await fastify.inject({
				method: "POST",
				url: "/twofa/totp/validate",
				payload: { twofa_uuid: id, totp_code: "123456" },
			});
			expect(res.statusCode).toBe(401);
			expect(JSON.parse(res.body).message).toBe("Invalid or expired TOTP code.");
		});

		it("returns 404 if verify2FaMethod fails", async () => {
			const id = uuidv7();
			(getUserTotpMethodById as Mock).mockReturnValue({
				method: { method_id: id, method_type: 1, user_id: "user123", is_verified: true },
				totp: { secret_encrypted: "abcd", secret_meta: "{}" },
			});
			(decryptSecret as Mock).mockReturnValue("secret");
			(verifyTotp as Mock).mockReturnValue(true);
			(verify2FaMethod as Mock).mockReturnValue(false);

			const res = await fastify.inject({
				method: "POST",
				url: "/twofa/totp/validate",
				payload: { twofa_uuid: id, totp_code: "123456" },
			});
			expect(res.statusCode).toBe(404);
		});

		it("returns 200 if valid", async () => {
			const id = uuidv7();
			(getUserTotpMethodById as Mock).mockReturnValue({
				method: { method_id: id, method_type: 1, user_id: "user123", is_verified: true },
				totp: { secret_encrypted: "abcd", secret_meta: "{}" },
			});
			(decryptSecret as Mock).mockReturnValue("secret");
			(verifyTotp as Mock).mockReturnValue(true);
			(verify2FaMethod as Mock).mockReturnValue(true);

			const res = await fastify.inject({
				method: "POST",
				url: "/twofa/totp/validate",
				payload: { twofa_uuid: id, totp_code: "123456" },
			});
			expect(res.statusCode).toBe(200);
			expect(JSON.parse(res.body).message).toBe(
				"TOTP code validated successfully."
			);
		});
	});

	// ---------- TOKEN ROUTE ----------
	describe("POST /twofa/totp/token", () => {
		it("returns 429 if user rate limit exceeded", async () => {
			(checkRateLimit as Mock)
				.mockReturnValueOnce(true)
				.mockReturnValueOnce(false);
			const res = await fastify.inject({
				method: "POST",
				url: "/twofa/totp/token",
				payload: { twofa_uuid: uuidv7(), totp_code: "123456" },
			});
			expect(res.statusCode).toBe(429);
		});

		it("returns 400 if missing fields", async () => {
			const res = await fastify.inject({
				method: "POST",
				url: "/twofa/totp/token",
				payload: {},
			});
			expect(res.statusCode).toBe(400);
		});

		it("returns 400 if totp_code invalid format", async () => {
			const res = await fastify.inject({
				method: "POST",
				url: "/twofa/totp/token",
				payload: { twofa_uuid: uuidv7(), totp_code: "abc" },
			});
			expect(res.statusCode).toBe(400);
		});

		it("returns 404 if no user2faTotp found or invalid", async () => {
			(getUser2faTotpByMethodId as Mock).mockReturnValue(null);
			const res = await fastify.inject({
				method: "POST",
				url: "/twofa/totp/token",
				payload: { twofa_uuid: uuidv7(), totp_code: "123456" },
			});
			expect(res.statusCode).toBe(404);
		});

		it("returns 404 if verifyTotp fails (anti-enum)", async () => {
			(getUser2faTotpByMethodId as Mock).mockReturnValue({
				method_id: "123",
				secret_encrypted: "abcd",
				secret_meta: "{}",
			});
			(decryptSecret as Mock).mockReturnValue("secret");
			(verifyTotp as Mock).mockReturnValue(false);

			const res = await fastify.inject({
				method: "POST",
				url: "/twofa/totp/token",
				payload: { twofa_uuid: uuidv7(), totp_code: "123456" },
			});
			expect(res.statusCode).toBe(404);
		});

		it("returns 200 with token if valid", async () => {
			const id = uuidv7();

			(getUserTotpMethodById as Mock).mockReturnValue({
				method: { method_id: id, method_type: 1, user_id: "user123", is_verified: true },
				totp: { secret_encrypted: "abcd", secret_meta: "{}" },
			});
			(decryptSecret as Mock).mockReturnValue("secret");
			(verifyTotp as Mock).mockReturnValue(true);
			(generateRandomToken as Mock).mockReturnValue("randomToken123");
			(signToken as Mock).mockReturnValue("signedTokenXYZ");

			const res = await fastify.inject({
				method: "POST",
				url: "/twofa/totp/token",
				payload: { twofa_uuid: id, totp_code: "123456" },
			});

			expect(res.statusCode).toBe(200);
			const body = JSON.parse(res.body);
			expect(body).toHaveProperty("token");
			expect(body.token).toBe("signedTokenXYZ");
		});
	});
});
