/**
 * @file backend/tests/routes/users/twoFa/totp.test.ts
 * Tests for totpRoutes
 */

import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";
import Fastify from "fastify";
import { v7 as uuidv7 } from "uuid";

vi.mock("../../../../src/db/index.js", () => ({
	__esModule: true,
	getUserTotpMethodById: vi.fn(),
	verify2FaMethod: vi.fn(),
}));

vi.mock("../../../../src/utils/crypto.js", () => ({
	__esModule: true,
	decryptSecret: vi.fn(),
}));

vi.mock("../../../../src/auth/2Fa/totpUtils.js", () => ({
	__esModule: true,
	verifyTotp: vi.fn(),
}));

vi.mock("../../../../src/middleware/auth.middleware.js", () => ({
	__esModule: true,
	requireAuth: vi.fn((req, reply, done) => {
		(req as any).session = { user_id: "test-user", ip: "127.0.0.1" };
		done();
	}),
}));

vi.mock("../../../../src/utils/security.js", () => ({
	__esModule: true,
	checkRateLimit: vi.fn(() => true),
}));

import { totpRoutes } from "../../../../src/routes/users/twoFa/totp.route.js";
import { getUserTotpMethodById, verify2FaMethod } from "../../../../src/db/index.js";
import { decryptSecret } from "../../../../src/utils/crypto.js";
import { verifyTotp } from "../../../../src/auth/2Fa/totpUtils.js";

describe("/twofa/totp/validate route", () => {
	let fastify: ReturnType<typeof Fastify>;

	beforeEach(async () => {
		vi.resetAllMocks();
		fastify = Fastify();
		fastify.register(totpRoutes);
		await fastify.ready();
	});

	afterEach(async () => {
		try { await fastify.close(); } catch (_) {}
		vi.restoreAllMocks();
	});

	it("returns 400 if twofa_uuid or totp_code is missing", async () => {
		const res = await fastify.inject({ method: "POST", url: "/twofa/totp/validate", payload: {} });
		expect(res.statusCode).toBe(400);
		const body = JSON.parse(res.body);
		expect(body.message).toBe("twofa_uuid and totp_code are required.");
	});

	it("returns 400 if totp_code format is invalid", async () => {
		const res = await fastify.inject({
			method: "POST",
			url: "/twofa/totp/validate",
			payload: { twofa_uuid: uuidv7(), totp_code: "abc123" },
		});
		expect(res.statusCode).toBe(400);
		const body = JSON.parse(res.body);
		expect(body.message).toBe("Invalid TOTP format.");
	});

	it("returns 404 if method not found", async () => {
		(getUserTotpMethodById as Mock).mockReturnValue(null);

		const res = await fastify.inject({
			method: "POST",
			url: "/twofa/totp/validate",
			payload: { twofa_uuid: uuidv7(), totp_code: "123456" },
		});
		expect(res.statusCode).toBe(404);
		const body = JSON.parse(res.body);
		expect(body.message).toBe("TOTP method not found.");
	});

	it("returns 401 if TOTP code is invalid", async () => {
		const methodId = uuidv7();
		(getUserTotpMethodById as Mock).mockReturnValue({
			method: { method_id: methodId, method_type: 1 },
			totp: { secret_encrypted: "abcd", secret_meta: JSON.stringify({ digits: 6, period: 30 }) },
		});
		(decryptSecret as Mock).mockReturnValue("secret");
		(verifyTotp as Mock).mockReturnValue(false);

		const res = await fastify.inject({
			method: "POST",
			url: "/twofa/totp/validate",
			payload: { twofa_uuid: methodId, totp_code: "123456" },
		});
		expect(res.statusCode).toBe(401);
		const body = JSON.parse(res.body);
		expect(body.message).toBe("Invalid TOTP code.");
	});

	it("returns 500 if verification fails", async () => {
		const methodId = uuidv7();
		(getUserTotpMethodById as Mock).mockReturnValue({
			method: { method_id: methodId, method_type: 1 },
			totp: { secret_encrypted: "abcd", secret_meta: JSON.stringify({ digits: 6, period: 30 }) },
		});
		(decryptSecret as Mock).mockReturnValue("secret");
		(verifyTotp as Mock).mockReturnValue(true);
		(verify2FaMethod as Mock).mockReturnValue(false);

		const res = await fastify.inject({
			method: "POST",
			url: "/twofa/totp/validate",
			payload: { twofa_uuid: methodId, totp_code: "123456" },
		});
		expect(res.statusCode).toBe(500);
		const body = JSON.parse(res.body);
		expect(body.message).toBe("Failed to verify TOTP method.");
	});

	it("returns 200 if TOTP code is valid", async () => {
		const methodId = uuidv7();
		(getUserTotpMethodById as Mock).mockReturnValue({
			method: { method_id: methodId, method_type: 1 },
			totp: { secret_encrypted: "abcd", secret_meta: JSON.stringify({ digits: 6, period: 30 }) },
		});
		(decryptSecret as Mock).mockReturnValue("secret");
		(verifyTotp as Mock).mockReturnValue(true);
		(verify2FaMethod as Mock).mockReturnValue(true);

		const res = await fastify.inject({
			method: "POST",
			url: "/twofa/totp/validate",
			payload: { twofa_uuid: methodId, totp_code: "123456" },
		});
		expect(res.statusCode).toBe(200);
		const body = JSON.parse(res.body);
		expect(body.message).toBe("TOTP code validated successfully.");
	});
});
