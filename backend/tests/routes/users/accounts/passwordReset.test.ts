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
			getProfileByUserId: vi.fn()
		}));
		vi.mock("../../../../src/db/wrappers/auth/index.js", async (importOriginal) => {
			const actual = await importOriginal();
			return {
				__esModule: true,
				createEmailVerification: vi.fn(),
				getEmailVerificationByToken: vi.fn(),
				getEmailVerificationsByUserId: vi.fn(() => [
				{ user_id: "123", verified: false, expires_at: Date.now() - 1000 },
				]),
			};
		});
		vi.doMock("../../../../src/utils/crypto.js", () => ({
			__esModule: true,
			hashString: vi.fn(async (plain: string) => `hashed_${plain}`),
			generateRandomToken: vi.fn((len: number) => "fixed_test_token_1234567890"),
		}));

		vi.doMock("../../../../src/utils/mail/mail.js", () => ({
			__esModule: true,
			sendMail: vi.fn().mockResolvedValue(true),
		}));

		const mod = await import("../../../../src/routes/users/accounts/passwordReset.route.js");
		const { newPasswordReset } = mod;

		fastify = Fastify();
		fastify.register(newPasswordReset);
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
		expect(res.json()).toHaveProperty("success");
		expect(res.json().success).toMatch(/if the request is valid, an email will be sent shortly./i);
	});

	it("returns 202 and sends email if user exists", async () => {
		const res = await fastify.inject({ method: "GET", url: "/accounts/reset-password?email=exists@example.com" });
		expect(res.statusCode).toBe(202);
		expect(res.json()).toHaveProperty("success");
		expect(res.json().success).toMatch(/if the request is valid, an email will be sent shortly./i);
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
        expect(res.json()).toHaveProperty("success");
        expect(res.json().success).toMatch(/if the request is valid, an email will be sent shortly./i);
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
        expect(res.json()).toHaveProperty("success");
        expect(res.json().success).toMatch(/if the request is valid, an email will be sent shortly./i);
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
        expect(res.json()).toHaveProperty("success");
        expect(res.json().success).toMatch(/if the request is valid, an email will be sent shortly./i);
        expect((mocks.mail.sendMail as any)).toHaveBeenCalled();
    });

	it ("check the rate with ip", async () => {
		(mocks.main.getUserByEmail as any).mockReturnValue({ user_id: 4, role_id: 1, email: "user@example.com" });
        (mocks.main.getRoleById as any).mockReturnValue({ role_name: "user" });

		const res = await fastify.inject({
            method: "GET",
            url: "/accounts/reset-password?email=user@example.com"
        });
	});

	it("applies rate limit by IP (too many requests from same IP)", async () => {
		(mocks.main.getUserByEmail as any).mockReturnValue({ user_id: 4, role_id: 1, email: "iplimit@example.com" });
        (mocks.main.getRoleById as any).mockReturnValue({ role_name: "user" });

        for (let i = 0; i < RATE_LIMIT; i++) {
            const res = await fastify.inject({
                method: "GET",
                url: "/accounts/reset-password?email=iplimit@example.com",
                headers: { "x-forwarded-for": "1.2.3.4" },
            });
            expect(res.statusCode).toBe(202);
        }

        const resBlocked = await fastify.inject({
            method: "GET",
            url: "/accounts/reset-password?email=iplimit@example.com",
            headers: { "x-forwarded-for": "1.2.3.4" },
        });

        expect([429, 400]).toContain(resBlocked.statusCode);
        expect(resBlocked.json()).toHaveProperty("message");
        expect(resBlocked.json().message).toMatch(/Too many requests. Try again later./i);
	});

	it("returns 202 if an active verification link exists", async () => {
		(mocks.auth.getEmailVerificationsByUserId as any).mockReturnValue([
			{ user_id: 1, verified: false, expires_at: Date.now() + 10000 }
		]);

		const res = await fastify.inject({
			method: "GET",
			url: "/accounts/reset-password?email=exists@example.com"
		});

		expect(res.statusCode).toBe(202);
		expect(res.json()).toHaveProperty("success");
		expect(res.json().success).toMatch(/if the request is valid, an email will be sent shortly./i);
	});

	it("marks expired verification as verified and proceeds", async () => {
		const expiredTime = Date.now() - 1000;
		(mocks.auth.getEmailVerificationsByUserId as any).mockReturnValue([
			{ user_id: 1, verified: false, expires_at: expiredTime }
		]);

		const res = await fastify.inject({
			method: "GET",
			url: "/accounts/reset-password?email=exists@example.com"
		});

		expect(res.statusCode).toBe(202);
		expect(res.json()).toHaveProperty("success");
		expect(res.json().success).toMatch(/if the request is valid, an email will be sent shortly./i);

		const verifications = (mocks.auth.getEmailVerificationsByUserId as any)();
		expect(verifications[0].verified).toBe(true);
	});

	it("proceeds normally if no existing verification", async () => {
		(mocks.auth.getEmailVerificationsByUserId as any).mockReturnValue([]);

		const res = await fastify.inject({
			method: "GET",
			url: "/accounts/reset-password?email=exists@example.com"
		});

		expect(res.statusCode).toBe(202);
		expect(res.json()).toHaveProperty("success");
		expect(res.json().success).toMatch(/if the request is valid, an email will be sent shortly./i);
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
		expect(res.statusCode).toBe(400);
		expect(res.json()).toHaveProperty("error");
		expect(res.json().error).toMatch(/Field not completed/i);
	});

    it("returns 202 when token invalid in POST", async () => {
		const payload = { new_password: "Aa1!aaaa", new_password_confirm: "Aa1!aaaa", token: "bhjvhhkvvh" };
		const res = await fastify.inject({ method: "POST", url: "/accounts/reset-password", payload });
		expect(res.statusCode).toBe(202);
		expect(res.json()).toHaveProperty("success");
		expect(res.json().success).toMatch(/If the request is valid, the password will be changed shortly./i);
	});

	it("returns 202 when passwords do not match in POST", async () => {
		const payload = { new_password: "Aa1!aaaa", new_password_confirm: "Bb2!bbbb", token: "fixed_test_token_1234567890" };
		const res = await fastify.inject({ method: "POST", url: "/accounts/reset-password", payload });
		expect(res.statusCode).toBe(202);
		expect(res.json()).toHaveProperty("success");
		expect(res.json().success).toMatch(/If the request is valid, the password will be changed shortly./i);
	});

    it("returns 202 when passwords do not match in POST", async () => {
		const payload = { new_password: "Aa1!aaaa", new_password_confirm: "", token: "fixed_test_token_1234567890" };
		const res = await fastify.inject({ method: "POST", url: "/accounts/reset-password", payload });
		expect(res.statusCode).toBe(202);
		expect(res.json()).toHaveProperty("success");
		expect(res.json().success).toMatch(/If the request is valid, the password will be changed shortly./i);
	});

    it("returns 202 when passwords is incorrect in POST", async () => {
		const payload = { new_password: "s", new_password_confirm: "s", token: "fixed_test_token_1234567890" };
		const res = await fastify.inject({ method: "POST", url: "/accounts/reset-password", payload });
		expect(res.statusCode).toBe(400);
		expect(res.json()).toHaveProperty("error");
		expect(res.json().error).toMatch(/Password invalid/i);
	});

	it("updates password successfully and verifies hashed password", async () => {
		const payload = { 
			new_password: "Aa1!aaaa!", 
			new_password_confirm: "Aa1!aaaa!", 
			token: "fixed_test_token_1234567890" 
		};

		const hashSpy = vi.spyOn(mocks.crypto, "hashString");
		const res = await fastify.inject({ method: "POST", url: "/accounts/reset-password", payload });

		expect(res.statusCode).toBe(202);
		expect(res.json()).toHaveProperty("success");
		expect(res.json().success).toMatch(/If the request is valid, the password will be changed shortly./i);

		const hashedPassword = await hashSpy.mock.results[0].value;
		expect(mocks.main.updateUser).toHaveBeenCalledWith(1, { password_hash: hashedPassword });
		expect(hashedPassword).not.toBe(payload.new_password);
	});

    it("POST /accounts/reset-password should return 500 on internal error in getEmailVerificationByToken", async () => {
        (mocks.auth.getEmailVerificationByToken as any).mockImplementation(() => { throw new Error("DB fail"); });

        const payload = { new_password: "Aa1!aaaa!", new_password_confirm: "Aa1!aaaa!", token: "fixed_test_token_1234567890" };
        const res = await fastify.inject({ method: "POST", url: "/accounts/reset-password", payload });

        expect(res.statusCode).toBe(500);
        expect(res.json()).toEqual({ error: "Internal error" });
    });
});
