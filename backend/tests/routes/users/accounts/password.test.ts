/**
 * @file backend/tests/routes/users/accounts/password.test.ts
 * @description Updated tests for the user reset password route (OWASP-compliant).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";

const RATE_LIMIT = 5;

describe("GET & POST /accounts/reset-password", () => {
	let fastify: ReturnType<typeof Fastify>;
	let mocks: {
		main: any;
		auth: any;
		crypto: any;
		mail: any;
	};

	beforeEach(async () => {
		vi.resetModules();
		vi.restoreAllMocks();

		// --- Mocks ---
		vi.doMock("../../../../src/db/wrappers/main/index.js", () => ({
			__esModule: true,
			getUserByEmail: vi.fn(),
			getRoleById: vi.fn(),
			updateUser: vi.fn(),
		}));

		vi.doMock("../../../../src/db/wrappers/auth/index.js", () => ({
			__esModule: true,
			createEmailVerification: vi.fn(),
			getEmailVerificationByToken: vi.fn(),
		}));

		vi.doMock("../../../../src/utils/crypto.js", () => ({
			__esModule: true,
			hashString: vi.fn(async (plain: string) => `hashed_${plain}`),
			generateRandomToken: vi.fn((len: number) => "fixed_test_token_1234567890"),
		}));

		vi.doMock("../../../../src/utils/mail/mail.js", () => ({
			__esModule: true,
			sendMail: vi.fn().mockResolvedValue(true),
		}));

		const mod = await import("../../../../src/routes/users/accounts/password.route.js");
		const { newPasswordReset, passwordReset } = mod;

		fastify = Fastify();
		fastify.register(newPasswordReset);
		fastify.register(passwordReset);
		await fastify.ready();

		const main = await import("../../../../src/db/wrappers/main/index.js");
		const auth = await import("../../../../src/db/wrappers/auth/index.js");
		const crypto = await import("../../../../src/utils/crypto.js");
		const mail = await import("../../../../src/utils/mail/mail.js");

		(main.getUserByEmail as any).mockImplementation((email: string) => {
			if (email === "exists@example.com") return { user_id: 1, role_id: 1, email };
			return null;
		});
		(main.getRoleById as any).mockReturnValue({ role_name: "user" });
		(auth.getEmailVerificationByToken as any).mockImplementation((token: string) => {
            if (token === "fixed_test_token_1234567890") {
                return { user_id: 1, email: "exists@example.com" };
            }
            return null;
        });
		(crypto.hashString as any).mockResolvedValue("hashed_token");

		mocks = { main, auth, crypto, mail };
	});

	afterEach(async () => {
		try { await fastify.close(); } catch (_) {}
		vi.resetAllMocks();
		vi.restoreAllMocks();
	});

	it("returns 400 when email is missing", async () => {
		const res = await fastify.inject({ method: "GET", url: "/accounts/reset-password" });
		expect(res.statusCode).toBe(400);
		expect(res.json()).toHaveProperty("error");
		expect(res.json().error).toMatch(/Email missing/i);
	});

	it("returns 400 for invalid email format", async () => {
		const res = await fastify.inject({ method: "GET", url: "/accounts/reset-password?email=bademail" });
		expect(res.statusCode).toBe(400);
		expect(res.json()).toHaveProperty("error");
		expect(res.json().error).toMatch(/Email invalid/i);
	});

	it("returns 202 if user does not exist (prevents enumeration)", async () => {
		const res = await fastify.inject({ method: "GET", url: "/accounts/reset-password?email=unknown@example.com" });
		expect(res.statusCode).toBe(202);
		expect(res.json()).toHaveProperty("duck");
		expect(res.json().duck).toMatch(/Email has been sent/i);
	});

	it("returns 202 and sends email if user exists", async () => {
		const res = await fastify.inject({ method: "GET", url: "/accounts/reset-password?email=exists@example.com" });
		expect(res.statusCode).toBe(202);
		expect(res.json()).toHaveProperty("duck");
		expect(res.json().duck).toMatch(/Email has been sent/i);
		expect((mocks.mail.sendMail as any)).toHaveBeenCalled();
	});

    it("does not send email if user role is banned", async () => {
        (mocks.main.getUserByEmail as any).mockReturnValue({ user_id: 2, role_id: 2, email: "banned@example.com" });
        (mocks.main.getRoleById as any).mockReturnValue({ role_name: "banned" });

        const res = await fastify.inject({
            method: "GET",
            url: "/accounts/reset-password?email=banned@example.com"
        });

        expect(res.statusCode).toBe(202);
        expect(res.json()).toHaveProperty("duck");
        expect(res.json().duck).toMatch(/Email has been sent/i);
        expect((mocks.mail.sendMail as any)).not.toHaveBeenCalled();
    });

    it("does not send email if user role is unverified", async () => {
        (mocks.main.getUserByEmail as any).mockReturnValue({ user_id: 3, role_id: 3, email: "unverified@example.com" });
        (mocks.main.getRoleById as any).mockReturnValue({ role_name: "unverified" });

        const res = await fastify.inject({
            method: "GET",
            url: "/accounts/reset-password?email=unverified@example.com"
        });

        expect(res.statusCode).toBe(202);
        expect(res.json()).toHaveProperty("duck");
        expect(res.json().duck).toMatch(/Email has been sent/i);
        expect((mocks.mail.sendMail as any)).not.toHaveBeenCalled();
    });

    it("sends email if user role is normal", async () => {
        (mocks.main.getUserByEmail as any).mockReturnValue({ user_id: 4, role_id: 1, email: "user@example.com" });
        (mocks.main.getRoleById as any).mockReturnValue({ role_name: "user" });

        const res = await fastify.inject({
            method: "GET",
            url: "/accounts/reset-password?email=user@example.com"
        });

        expect(res.statusCode).toBe(202);
        expect(res.json()).toHaveProperty("duck");
        expect(res.json().duck).toMatch(/Email has been sent/i);
        expect((mocks.mail.sendMail as any)).toHaveBeenCalled();
    });

    it("GET /accounts/reset-password should return 500 on internal error", async () => {
        (mocks.main.getUserByEmail as any).mockImplementation(() => { throw new Error("DB fail"); });

        const res = await fastify.inject({
            method: "GET",
            url: "/accounts/reset-password?email=exists@example.com"
        });

        expect(res.statusCode).toBe(500);
        expect(res.json()).toEqual({ error: "Internal error" });
    });

	it("returns 202 when token missing in POST", async () => {
		const payload = { new_password: "Aa1!aaaa", new_password_confirm: "Aa1!aaaa", token: "" };
		const res = await fastify.inject({ method: "POST", url: "/accounts/reset-password", payload });
		expect(res.statusCode).toBe(202);
		expect(res.json()).toHaveProperty("error");
		expect(res.json().error).toMatch(/Password has been change/i);
	});

    it("returns 202 when token invalid in POST", async () => {
		const payload = { new_password: "Aa1!aaaa", new_password_confirm: "Aa1!aaaa", token: "bhjvhhkvvh" };
		const res = await fastify.inject({ method: "POST", url: "/accounts/reset-password", payload });
		expect(res.statusCode).toBe(202);
		expect(res.json()).toHaveProperty("error");
		expect(res.json().error).toMatch(/Password has been change/i);
	});

	it("returns 202 when passwords do not match in POST", async () => {
		const payload = { new_password: "Aa1!aaaa", new_password_confirm: "Bb2!bbbb", token: "fixed_test_token_1234567890" };
		const res = await fastify.inject({ method: "POST", url: "/accounts/reset-password", payload });
		expect(res.statusCode).toBe(400);
		expect(res.json()).toHaveProperty("error");
		expect(res.json().error).toMatch(/The confirm password is different/i);
	});

    it("returns 202 when passwords do not match in POST", async () => {
		const payload = { new_password: "Aa1!aaaa", new_password_confirm: "", token: "fixed_test_token_1234567890" };
		const res = await fastify.inject({ method: "POST", url: "/accounts/reset-password", payload });
		expect(res.statusCode).toBe(400);
		expect(res.json()).toHaveProperty("error");
		expect(res.json().error).toMatch(/Field not completed/i);
	});

    it("returns 202 when passwords is incorrect in POST", async () => {
		const payload = { new_password: "s", new_password_confirm: "s", token: "fixed_test_token_1234567890" };
		const res = await fastify.inject({ method: "POST", url: "/accounts/reset-password", payload });
		expect(res.statusCode).toBe(400);
		expect(res.json()).toHaveProperty("error");
		expect(res.json().error).toMatch(/Password invalid/i);
	});

	it("updates password successfully", async () => {
		const payload = { new_password: "Aa1!aaaa!", new_password_confirm: "Aa1!aaaa!", token: "fixed_test_token_1234567890" };
		const res = await fastify.inject({ method: "POST", url: "/accounts/reset-password", payload });
		expect(res.statusCode).toBe(202);
		expect(res.json()).toHaveProperty("duck");
		expect(res.json().duck).toMatch(/Password has been change GOOD/i);
		expect((mocks.main.updateUser as any)).toHaveBeenCalledWith(1, { password_hash: "Aa1!aaaa!" });
	});

    it("POST /accounts/reset-password should return 500 on internal error in getEmailVerificationByToken", async () => {
        (mocks.auth.getEmailVerificationByToken as any).mockImplementation(() => { throw new Error("DB fail"); });

        const payload = { new_password: "Aa1!aaaa!", new_password_confirm: "Aa1!aaaa!", token: "fixed_test_token_1234567890" };
        const res = await fastify.inject({ method: "POST", url: "/accounts/reset-password", payload });

        expect(res.statusCode).toBe(500);
        expect(res.json()).toEqual({ error: "Internal error" });
    });
});
