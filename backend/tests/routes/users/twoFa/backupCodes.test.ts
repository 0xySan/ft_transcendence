/**
 * @file backupCodes.route.test.ts
 * @description Tests for 2FA backup codes routes.
 */

import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";
import Fastify from "fastify";
import { v7 as uuidv7 } from "uuid";

vi.mock("../../../../src/middleware/auth.middleware.js", () => ({
	__esModule: true,
	requirePartialAuth: vi.fn((req, reply, done) => {
		(req as any).session = { user_id: "user123" };
		done();
	}),
}));

vi.mock("../../../../src/db/index.js", () => ({
	__esModule: true,
	getUserBCodesMethodById: vi.fn(),
	updateBCodes: vi.fn(),
}));

vi.mock("../../../../src/utils/crypto.js", () => ({
	__esModule: true,
	hashString: vi.fn(),
	generateRandomToken: vi.fn(),
	signToken: vi.fn(),
	verifyToken: vi.fn(),
}));

vi.mock("../../../../src/utils/security.js", () => ({
	__esModule: true,
	checkRateLimit: vi.fn(() => true),
}));

import { backupCodesRoute } from "../../../../src/routes/users/twoFa/backupCodes.route.js";
import { getUserBCodesMethodById, updateBCodes } from "../../../../src/db/index.js";
import { hashString, generateRandomToken, signToken, verifyToken } from "../../../../src/utils/crypto.js";
import { requirePartialAuth } from "../../../../src/middleware/auth.middleware.js";

describe("Backup Codes 2FA routes", () => {
	let fastify: ReturnType<typeof Fastify>;
	const fakeMethodId = uuidv7();
	const backupCodeId = 1;
	const fakeCodes = [{ hash: "hashedCode1", used: false }, { hash: "hashedCode2", used: false }];

	beforeEach(async () => {
		vi.resetAllMocks();
		fastify = Fastify();
		fastify.register(backupCodesRoute);
		await fastify.ready();
	});

	afterEach(async () => { try { await fastify.close(); } catch {} });

	// ---------- GET BACKUP CODES ----------
	describe("GET /twofa/backup-codes", () => {
		it("returns 401 if not authenticated", async () => {
			(requirePartialAuth as Mock).mockImplementationOnce((req, reply, done) => {
				done();
			});
			const res = await fastify.inject({ method: "GET", url: "/twofa/backup-codes" });
			expect(res.statusCode).toBe(401);
		});

		it("returns 400 if query missing fields", async () => {
			const res = await fastify.inject({ method: "GET", url: "/twofa/backup-codes" });
			expect(res.statusCode).toBe(400);
			expect(JSON.parse(res.body).message).toBe("Invalid request body");
		});

		it("returns 400 if token invalid", async () => {
			(verifyToken as Mock).mockReturnValue(false);
			const res = await fastify.inject({ method: "GET", url: `/twofa/backup-codes?uuid=${fakeMethodId}&token=tok` });
			expect(res.statusCode).toBe(400);
			expect(JSON.parse(res.body).message).toBe("Invalid token");
		});

		it("returns 404 if method not found", async () => {
			(verifyToken as Mock).mockReturnValue(true);
			(getUserBCodesMethodById as Mock).mockReturnValue(undefined);
			const res = await fastify.inject({ method: "GET", url: `/twofa/backup-codes?uuid=${fakeMethodId}&token=tok` });
			expect(res.statusCode).toBe(404);
			expect(JSON.parse(res.body).message).toBe("Backup codes not found");
		});

		it("returns 200 with codes if valid", async () => {
			(verifyToken as Mock).mockReturnValue(true);
			(getUserBCodesMethodById as Mock).mockReturnValue({
				method: { user_id: "user123" },
				codes: { code_json: JSON.stringify(fakeCodes) }
			});
			const res = await fastify.inject({ method: "GET", url: `/twofa/backup-codes?uuid=${fakeMethodId}&token=tok` });
			expect(res.statusCode).toBe(200);
			expect(JSON.parse(res.body).codes).toHaveLength(2);
		});

		it ("Throw verifyToken error returns 400", async () => {
			(verifyToken as Mock).mockImplementation(() => { throw new Error("fail"); });
			const res = await fastify.inject({ method: "GET", url: `/twofa/backup-codes?uuid=${fakeMethodId}&token=tok` });
			expect(res.statusCode).toBe(400);
			expect(JSON.parse(res.body).message).toBe("Invalid token");
		});
	});

	// ---------- POST VERIFY BACKUP CODE ----------
	describe("POST /twofa/backup-codes", () => {
		it("returns 401 if not authenticated", async () => {
			(requirePartialAuth as Mock).mockImplementationOnce((req, reply, done) => {
				done();
			});
			const res = await fastify.inject({ method: "POST", url: "/twofa/backup-codes", payload: {} });
			expect(res.statusCode).toBe(401);
		});

		it("returns 400 if body missing fields", async () => {
			const res = await fastify.inject({ method: "POST", url: "/twofa/backup-codes", payload: {} });
			expect(res.statusCode).toBe(400);
		});

		it("returns 404 if method not found", async () => {
			(getUserBCodesMethodById as Mock).mockReturnValue(undefined);
			const res = await fastify.inject({ method: "POST", url: "/twofa/backup-codes", payload: { uuid: fakeMethodId, code: "code" } });
			expect(res.statusCode).toBe(404);
		});

		it("returns 404 if code invalid or already used", async () => {
			const method = { method: { user_id: "user123" }, codes: { backup_code_id: backupCodeId, code_json: JSON.stringify(fakeCodes) } };
			(getUserBCodesMethodById as Mock).mockReturnValue(method);
			(hashString as Mock).mockResolvedValue("notMatching");
			const res = await fastify.inject({ method: "POST", url: "/twofa/backup-codes", payload: { uuid: fakeMethodId, code: "wrong" } });
			expect(res.statusCode).toBe(404);
		});

		it("returns 404 if code already used", async () => {
			const usedCodes = [{ hash: "hashedCode1", used: true }, { hash: "hashedCode2", used: false }];
			const method = { method: { user_id: "user123" }, codes: { backup_code_id: backupCodeId, code_json: JSON.stringify(usedCodes) } };
			(getUserBCodesMethodById as Mock).mockReturnValue(method);
			(hashString as Mock).mockResolvedValue("hashedCode1");
			const res = await fastify.inject({ method: "POST", url: "/twofa/backup-codes", payload: { uuid: fakeMethodId, code: "any" } });
			expect(res.statusCode).toBe(404);
		});

		it("returns 200 and marks code as used", async () => {
			const method = { method: { user_id: "user123", is_verified: true, method_type: 2 }, codes: { backup_code_id: backupCodeId, code_json: JSON.stringify(fakeCodes) } };
			(getUserBCodesMethodById as Mock).mockReturnValue(method);
			(hashString as Mock).mockResolvedValue("hashedCode1");
			(generateRandomToken as Mock).mockReturnValue("random");
			(signToken as Mock).mockReturnValue("signedToken");

			const res = await fastify.inject({ method: "POST", url: "/twofa/backup-codes", payload: { uuid: fakeMethodId, code: "any" } });
			expect(res.statusCode).toBe(200);
			const body = JSON.parse(res.body);
			expect(body.token).toBe("signedToken");
			expect(body.remaining).toBe(1);
			expect(updateBCodes).toHaveBeenCalled();
		});

		it("Return 404 if method not verified", async () => {
			const method = { method: { user_id: "user123", is_verified: false, method_type: 2 }, codes: { backup_code_id: backupCodeId, code_json: JSON.stringify(fakeCodes) } };
			(getUserBCodesMethodById as Mock).mockReturnValue(method);
			const res = await fastify.inject({ method: "POST", url: "/twofa/backup-codes", payload: { uuid: fakeMethodId, code: "any" } });
			expect(res.statusCode).toBe(404);
		});

		it("Return 404 if method not backup codes", async () => {
			const method = { method: { user_id: "user123", is_verified: true, method_type: 1 }, codes: { backup_code_id: backupCodeId, code_json: JSON.stringify(fakeCodes) } };
			(getUserBCodesMethodById as Mock).mockReturnValue(method);
			const res = await fastify.inject({ method: "POST", url: "/twofa/backup-codes", payload: { uuid: fakeMethodId, code: "any" } });
			expect(res.statusCode).toBe(404);
		});
	});
});