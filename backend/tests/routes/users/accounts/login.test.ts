/**
 * @file backend/tests/routes/users/accounts/login.test.ts
 * @description Tests for the user account login route (OWASP-compliant).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";

describe("POST /accounts/login", () => {
	let fastify: ReturnType<typeof Fastify>;
		let mocks: {
			db: any;
			crypto: any;
			session: any;
		};

	beforeEach(async () => {
		vi.resetModules();
		vi.restoreAllMocks();

		// Mock DB helpers
		vi.doMock("../../../../src/db/index.js", () => ({
			__esModule: true,
			getPasswordHashByUserId: vi.fn(),
			getProfileByUsername: vi.fn(),
			getUser2FaMethodsByUserId: vi.fn(),
			getUserByEmail: vi.fn(),
			createNewSession: vi.fn(),
			updateSession: vi.fn(),
		}));

		// Mock crypto verify
		vi.doMock("../../../../src/utils/crypto.js", () => ({
			__esModule: true,
			verifyHashedString: vi.fn(),
			verifyToken: vi.fn(),
		}));
		vi.doMock("../../../../src/utils/session.js", () => ({
			__esModule: true,
			createNewSession: vi.fn(() => ({
				token: "tok",
				session: { id: 1 },
			})),
		}));

		vi.doMock("../../../../src/middleware/auth.middleware.js", () => ({
			__esModule: true,
			requirePartialAuth: vi.fn((req: any, res: any, done: any) => {
				req.session = { session_id: "sid1", user_id: "uid1", stage: "partial", token: "tok" };
				done();
			}),
		}));

		// Import the route AFTER mocks
		const mod = await import("../../../../src/routes/users/accounts/login.route.js");
		const { newUserLoginRoutes } = mod;

		// Setup Fastify with the route
		fastify = Fastify();

		// Provide a no-op setCookie implementation so route.setCookie calls don't throw in tests
		// Fastify cookie plugin isn't required for these unit tests.
		// @ts-ignore - test helper
		(fastify as any).decorateReply?.('setCookie', (name: string, value: string, opts?: any) => {});
		fastify.register(newUserLoginRoutes);
		await fastify.ready();

		// Get mocks for assertions
		const db = await import("../../../../src/db/index.js");
		const crypto = await import("../../../../src/utils/crypto.js");
		const session = await import("../../../../src/utils/session.js");
		mocks = { db, crypto, session };
	});

	afterEach(async () => {
		try { await fastify.close(); } catch (_) {}
		vi.resetAllMocks();
		vi.restoreAllMocks();
	});

	it("returns 400 for invalid password format or non-existing user (generic message)", async () => {
		// invalid password (too short)
		const payloadShort = { username: "u1", password: "short" };
		// ensure no user found
		(mocks.db.getProfileByUsername as any).mockReturnValue(null);
		const resShort = await fastify.inject({ method: "POST", url: "/accounts/login", payload: payloadShort });
		expect(resShort.statusCode).toBe(400);
		expect(resShort.json()).toHaveProperty("message");
		expect(resShort.json().message).toMatch(/Login failed/i);
	});

	it("returns 400 when password is incorrect", async () => {
		const payload = { email: "user@example.com", password: "WrongPass1" };
		(mocks.db.getUserByEmail as any).mockReturnValue({ user_id: 2 });
		(mocks.db.getPasswordHashByUserId as any).mockReturnValue("hashed_test_correctpassword");
		// verifyHashedString will return false for a wrong password
		(mocks.crypto.verifyHashedString as any).mockResolvedValue(false);

		const res = await fastify.inject({ method: "POST", url: "/accounts/login", payload });
		expect(res.statusCode).toBe(400);
		expect(res.json()).toHaveProperty("message");
		expect(res.json().message).toMatch(/Login failed/i);
	});

	it("returns 202 when 2FA is required", async () => {
		const payload = { username: "user2", password: "CorrectPass1" };
		(mocks.db.getProfileByUsername as any).mockReturnValue({ user_id: 3 });
		(mocks.db.getPasswordHashByUserId as any).mockReturnValue("hashed_test_CorrectPass1");
		(mocks.crypto.verifyHashedString as any).mockResolvedValue(true);
		(mocks.db.getUser2FaMethodsByUserId as any).mockReturnValue([{ method_type: "totp", is_verified: true, label: "Auth App", is_primary: true }]);

		const res = await fastify.inject({ method: "POST", url: "/accounts/login", payload });
		expect(res.statusCode).toBe(202);
		expect(res.json()).toHaveProperty("message");
		expect(res.json().message).toMatch(/2FA required./i);
		expect(res.cookies).toBeDefined();
	});

	it("returns 202 on successful login without 2FA", async () => {
		const payload = { email: "ok@example.com", password: "CorrectPass1" };
		
		// Setup mocks with proper return values
		mocks.db.getUserByEmail.mockReturnValue({ user_id: 1 });
		mocks.db.getPasswordHashByUserId.mockReturnValue("hashed_test_CorrectPass1");
		mocks.crypto.verifyHashedString.mockReturnValue(true);
		mocks.db.getUser2FaMethodsByUserId.mockReturnValue([]); // no 2FA
		mocks.session.createNewSession.mockReturnValue({ 
			token: "tok", 
			session: { id: 1 } 
		});

		const res = await fastify.inject({ 
			method: "POST", 
			url: "/accounts/login", 
			payload 
		});

		console.log('Response status:', res.statusCode); // Debug
		console.log('Response body:', res.json()); // Debug

		expect(res.statusCode).toBe(202);
		expect(res.json()).toHaveProperty("message");
		expect(res.json().message).toMatch(/Login successful/i);
		expect(res.cookies).toBeDefined();
	});

	it("rate limits after too many attempts and returns Retry-After header", async () => {
		const testIp = "9.8.7.6";
		const payload = { email: "rate@example.com", password: "CorrectPass1" };
		// make requests that will be accepted until rate limit reached
		(mocks.db.getUserByEmail as any).mockReturnValue({ user_id: 10 });
		(mocks.db.getPasswordHashByUserId as any).mockReturnValue("hashed_test_CorrectPass1");
		(mocks.crypto.verifyHashedString as any).mockResolvedValue(true);
		(mocks.db.getUser2FaMethodsByUserId as any).mockReturnValue([]);

		// RATE_LIMIT is 5 in route
		for (let i = 0; i < 5; i++) {
			const r = await fastify.inject({ method: "POST", url: "/accounts/login", payload, ip: testIp });
			expect([202, 400, 429, 500]).toContain(r.statusCode); // just ensure route responds; mostly 202 here
		}

		const r6 = await fastify.inject({ method: "POST", url: "/accounts/login", payload, ip: testIp });
		expect(r6.statusCode).toBe(429);
		expect(r6.headers).toHaveProperty("retry-after");
		expect(r6.json()).toHaveProperty("message");
		expect(r6.json().message).toMatch(/Too many requests. Try again later./i);
	});

	it ("returns 400 when both email and username are provided", async () => {
		const payload = { email: "email@example.com", username: "username", password: "password123" };
		const res = await fastify.inject({ method: "POST", url: "/accounts/login", payload });
		expect(res.statusCode).toBe(400);
		const body = res.json();
		expect(body).toHaveProperty("message");
		expect(body.message).toMatch(/Provide either email or username, not both./i);
	});

	it("returns 500 if an unexpected error occurs", async () => {
		const payload = { email: "crash@example.com", password: "AnyPass123" };

		// Make one of the DB calls throw
		(mocks.db.getUserByEmail as any).mockImplementation(() => {
			throw new Error("DB failure");
		});

		const res = await fastify.inject({
			method: "POST",
			url: "/accounts/login",
			payload,
		});

		expect(res.statusCode).toBe(500);
		const body = res.json();
		expect(body).toHaveProperty("message");
		expect(body.message).toMatch(/Login failed/i);
	});

	it("returns 429 when rate limit is exceeded by userid", async () => {
		// Simulate multiple requests from different IPs but same user ID
		const testIps = ["9.8.7.6", "9.8.7.5", "9.8.7.4", "9.8.7.3", "9.8.7.2"];
		const payload = { email: "rate@example.com", password: "CorrectPass1" };
		(mocks.db.getUserByEmail as any).mockReturnValue({ user_id: 20 });
		(mocks.db.getPasswordHashByUserId as any).mockReturnValue("hashed_test_CorrectPass1");
		(mocks.crypto.verifyHashedString as any).mockResolvedValue(true);
		(mocks.db.getUser2FaMethodsByUserId as any).mockReturnValue([]);

		// Make requests that will be accepted until rate limit reached.
		// Use `remoteAddress` so Fastify inject sets the request IP correctly.
		for (let i = 0; i < 5; i++) {
			const r = await fastify.inject({
				method: "POST",
				url: "/accounts/login",
				payload,
				remoteAddress: testIps[i],
			});
			expect([202, 400, 429, 500]).toContain(r.statusCode);
		}

		// Sixth request from one of the previous IPs should hit the per-user rate limit.
		const r6 = await fastify.inject({
			method: "POST",
			url: "/accounts/login",
			payload,
			remoteAddress: testIps[0],
		});

		expect(r6.statusCode).toBe(429);
		expect(r6.headers).toHaveProperty("retry-after");
		const body = r6.json();
		expect(body).toHaveProperty("message");
		expect(body.message).toMatch(/Too many requests. Try again later./i);
	});

	it ("returns 400 if hashed password is missing for existing user", async () => {
		const payload = { email: "missing@hashed.password", password: "AnyPass123" };
		(mocks.db.getUserByEmail as any).mockReturnValue({ user_id: 30 });
		(mocks.db.getPasswordHashByUserId as any).mockReturnValue(undefined); // missing hash

		const res = await fastify.inject({ method: "POST", url: "/accounts/login", payload });
		expect(res.statusCode).toBe(400);
		const body = res.json();
		expect(body).toHaveProperty("message");
		expect(body.message).toMatch(/Login failed/i);
	});

	it ("returns 400 if user does not exist", async () => {
		const payload = { email: "nonexistent@example.com", password: "AnyPass123" };
		(mocks.db.getUserByEmail as any).mockReturnValue(null);

		const res = await fastify.inject({ method: "POST", url: "/accounts/login", payload });
		expect(res.statusCode).toBe(400);
		const body = res.json();
		expect(body).toHaveProperty("message");
		expect(body.message).toMatch(/Login failed/i);
	});

	it ("returns 500 if createNewSession fails without 2fa", async () => {
		const payload = { email: "sessionfail@example.com", password: "AnyPass123" };
		(mocks.db.getUserByEmail as any).mockReturnValue({ user_id: 40 });
		(mocks.db.getPasswordHashByUserId as any).mockReturnValue("hashed_test_AnyPass123");
		(mocks.crypto.verifyHashedString as any).mockResolvedValue(true);
		(mocks.db.getUser2FaMethodsByUserId as any).mockReturnValue([]);
		(mocks.session.createNewSession as any).mockReturnValue(null); // simulate failure

		const res = await fastify.inject({ method: "POST", url: "/accounts/login", payload });
		expect(res.statusCode).toBe(500);
		const body = res.json();
		expect(body).toHaveProperty("message");
		expect(body.message).toMatch(/Login failed/i);
	});

	it ("returns 500 if createNewSession fails with 2fa", async () => {
		const payload = { email: "sessionfail@example.com", password: "AnyPass123" };
		(mocks.db.getUserByEmail as any).mockReturnValue({ user_id: 40 });
		(mocks.db.getPasswordHashByUserId as any).mockReturnValue("hashed_test_AnyPass123");
		(mocks.crypto.verifyHashedString as any).mockResolvedValue(true);
		(mocks.db.getUser2FaMethodsByUserId as any).mockReturnValue([{ is_verified: true }]);
		(mocks.session.createNewSession as any).mockReturnValue(null); // simulate failure

		const res = await fastify.inject({ method: "POST", url: "/accounts/login", payload });
		expect(res.statusCode).toBe(500);
		const body = res.json();
		expect(body).toHaveProperty("message");
		expect(body.message).toMatch(/Login failed/i);
	});

	describe("PATCH /accounts/login (2FA verification)", () => {
		it("returns 400 if token is missing", async () => {
			const res = await fastify.inject({
				method: "PATCH",
				url: "/accounts/login",
				payload: {},
			});
			expect(res.statusCode).toBe(400);
			expect(res.json().message).toMatch(/Missing 2FA token/i);
		});

		it("returns 401 if token is invalid or expired", async () => {
			const res = await fastify.inject({
				method: "PATCH",
				url: "/accounts/login",
				payload: { token: "invalid_token" },
			});
			expect(res.statusCode).toBe(401);
			expect(res.json().message).toMatch(/Invalid or expired token/i);
		});

		it("returns 500 if updateSession fails", async () => {
			mocks.crypto.verifyToken.mockReturnValue({ ok: true });
			mocks.db.updateSession.mockReturnValue(false);

			const res = await fastify.inject({
				method: "PATCH",
				url: "/accounts/login",
				payload: { token: "valid_token" },
			});
			expect(res.statusCode).toBe(500);
			expect(res.json().message).toMatch(/Failed to upgrade session/i);
		});

		it("returns 200 on successful 2FA verification", async () => {
			mocks.crypto.verifyToken.mockReturnValue({ ok: true });
			mocks.db.updateSession.mockReturnValue(true);

			const res = await fastify.inject({
				method: "PATCH",
				url: "/accounts/login",
				payload: { token: "valid_token" },
			});
			expect(res.statusCode).toBe(200);
			const body = res.json();
			expect(body.message).toMatch(/2FA verification successful/i);
			expect(body.user).toHaveProperty("id");
		});

		it("returns 500 if unexpected error occurs", async () => {
			mocks.crypto.verifyToken.mockImplementation(() => {
				throw new Error("Crypto failure");
			});
			const res = await fastify.inject({
				method: "PATCH",
				url: "/accounts/login",
				payload: { token: "valid_token" },
			});
			expect(res.statusCode).toBe(500);
			expect(res.json().message).toMatch(/Unable to complete login process/i);
		});
	});
});