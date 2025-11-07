/**
 * @file backend/tests/routes/users/accounts/register.test.ts
 * @description Updated tests for the user account registration route (OWASP-compliant).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";

describe("POST /accounts/register", () => {
	let fastify: ReturnType<typeof Fastify>;
	let mocks: {
		geoip: any;
		main: any;
		auth: any;
		crypto: any;
		userData: any;
	};

	beforeEach(async () => {
		vi.resetModules();
		vi.restoreAllMocks();

		// --- Mocks ---
		vi.doMock("geoip-lite", () => ({
			__esModule: true,
			default: { lookup: vi.fn() },
		}));

		vi.doMock("../../../../src/db/wrappers/main/index.js", () => ({
			__esModule: true,
			createUser: vi.fn(),
			getUserByEmail: vi.fn(),
			createProfile: vi.fn(),
			getProfileByUsername: vi.fn(),
			getCountryByCode: vi.fn(),
			getRoleByName: vi.fn().mockReturnValue({ role_id: 1, role_name: "unverified" }),
		}));

		vi.doMock("../../../../src/db/wrappers/auth/index.js", () => ({
			__esModule: true,
			getOauthAccountByProviderAndUserId: vi.fn(),
			createOauthAccount: vi.fn(),
			createEmailVerification: vi.fn().mockResolvedValue({ email: "user@example.com", token: "token123" }),
		}));

		vi.doMock("../../../../src/utils/crypto.js", () => {
			return {
				__esModule: true,
				hashString: vi.fn(async (plain: string) => `hashed_test_${plain}`),
				verifyHashedString: vi.fn(async (plain: string, hashed: string) => hashed === `hashed_test_${plain}`),
				generateRandomToken: vi.fn((len: number) => "fixed_test_token_0123456789"),
				encryptSecret: vi.fn((secret: string) => Buffer.from(secret, "utf8")),
				decryptSecret: vi.fn((buf: Buffer | string) => {
					if (typeof buf === "string") {
						return Buffer.from(buf, "base64").toString("utf8");
					}
					return buf.toString("utf8");
				}),
			};
		});

		vi.doMock("../../../../src/utils/userData.js", () => ({
			__esModule: true,
			saveAvatarFromUrl: vi.fn(),
		}));

		// Import route AFTER mocks
		const mod = await import("../../../../src/routes/users/accounts/register.route.js");
		const { newUserAccountRoutes } = mod;

		// Setup fastify with the route
		fastify = Fastify();
		fastify.register(newUserAccountRoutes);
		await fastify.ready();

		// Import mocks for assertions
		const geoip = await import("geoip-lite");
		const main = await import("../../../../src/db/wrappers/main/index.js");
		const auth = await import("../../../../src/db/wrappers/auth/index.js");
		const crypto = await import("../../../../src/utils/crypto.js");
		const userData = await import("../../../../src/utils/userData.js");

		// default createUser & hashString behaviour
		(main.createUser as any).mockImplementation((email: string) => ({ user_id: 1, email, role_id: 1 }));
		(crypto.hashString as any).mockResolvedValue("hashedpwd");

		mocks = { geoip, main, auth, crypto, userData };
	});

	afterEach(async () => {
		try { await fastify.close(); } catch (_) {}
		vi.resetAllMocks();
		vi.restoreAllMocks();
	});

	it("returns 400 when username is missing", async () => {
		const payload = { email: "user@example.com", password: "Aa1!aaaa" };
		const res = await fastify.inject({ method: "POST", url: "/accounts/register", payload });
		expect(res.statusCode).toBe(400);
		const body = res.json();
		expect(body).toHaveProperty("message");
		expect(body.message).toMatch(/invalid registration/i);
	});

	it("returns 400 for invalid email", async () => {
		const payload = { username: "user123", email: "invalid-email", password: "Aa1!aaaa" };
		const res = await fastify.inject({ method: "POST", url: "/accounts/register", payload });
		expect(res.statusCode).toBe(400);
		const body = res.json();
		expect(body).toHaveProperty("message");
		expect(body.message).toMatch(/invalid registration/i);
	});

	it("returns 400 when neither password nor oauth provided", async () => {
		const payload = { username: "user123", email: "user@example.com" };
		const res = await fastify.inject({ method: "POST", url: "/accounts/register", payload });
		expect(res.statusCode).toBe(400);
		const body = res.json();
		expect(body).toHaveProperty("message");
		expect(body.message).toMatch(/missing authentication/i);
	});

	it("returns 202 if email already exists (no enumeration)", async () => {
		(mocks.main.getUserByEmail as any).mockReturnValue({ user_id: 1 });
		const payload = { username: "user123", email: "exists@example.com", password: "Aa1!aaaa" };
		const res = await fastify.inject({ method: "POST", url: "/accounts/register", payload });
		expect(res.statusCode).toBe(202);
		expect(res.json()).toHaveProperty("message");
		expect(res.json().message).toMatch(/verification email/i);
	});

	it("returns 400 if username already taken (no enumeration)", async () => {
		(mocks.main.getProfileByUsername as any).mockReturnValue({ profile_id: 5 });
		const payload = { username: "taken_name", email: "user2@example.com", password: "Aa1!aaaa" };
		const res = await fastify.inject({ method: "POST", url: "/accounts/register", payload });
		expect(res.statusCode).toBe(400);
		expect(res.json()).toHaveProperty("message");
		expect(res.json().message).toMatch(/Username is already taken./i);
	});

	it("creates user with password and returns 202 (accepted)", async () => {
		const payload = { username: "newuser", email: "new@example.com", password: "Aa1!aaaa!" };
		const res = await fastify.inject({ method: "POST", url: "/accounts/register", payload });
		expect(res.statusCode).toBe(202);
		const body = res.json();
		expect(body).toHaveProperty("message");
		expect(body.message).toMatch(/verification email/i);
		// ensure profile creation called with expected args
		expect((mocks.main.createProfile as any)).toHaveBeenCalledWith(1, "newuser", "newuser", undefined, undefined);
	});

	it("creates user with oauth + pfp and calls createOauthAccount and saveAvatarFromUrl", async () => {
		(mocks.userData.saveAvatarFromUrl as any).mockResolvedValue("avatar_55.png");
		const payload = {
			username: "oauthuser",
			email: "oauth@example.com",
			oauth: { provider_name: "google", provider_user_id: "12345" },
			pfp: "https://example.com/avatar.png",
		};
		const res = await fastify.inject({ method: "POST", url: "/accounts/register", payload });
		expect(res.statusCode).toBe(202);
		expect((mocks.main.createProfile as any)).toHaveBeenCalledWith(1, "oauthuser", "oauthuser", "avatar_55.png", undefined);
		expect((mocks.auth.createOauthAccount as any)).toHaveBeenCalled();
	});

	it("continues creation if saveAvatarFromUrl throws (avatar optional)", async () => {
		(mocks.userData.saveAvatarFromUrl as any).mockRejectedValue(new Error("download fail"));
		const payload = {
			username: "userNoAvatar",
			email: "noavatar@example.com",
			oauth: { provider_name: "google", provider_user_id: "z123" },
			pfp: "https://bad.example/avatar.png",
		};
		const res = await fastify.inject({ method: "POST", url: "/accounts/register", payload });
		expect(res.statusCode).toBe(202);
		expect((mocks.main.createProfile as any)).toHaveBeenCalledWith(1, "userNoAvatar", "userNoAvatar", undefined, undefined);
	});

	it("returns 500 if createUser fails", async () => {
		(mocks.main.createUser as any).mockReturnValue(null);
		const payload = { username: "failuser", email: "failuser@example.com", password: "Aa1!aaaa!" };
		const res = await fastify.inject({ method: "POST", url: "/accounts/register", payload });
		expect(res.statusCode).toBe(500);
		const body = res.json();
		expect(body).toHaveProperty("message");
		expect(body.message).toMatch(/registration failed/i);
	});

	it("returns 500 if an unexpected error occurs", async () => {
		const payload = { username: "crashuser", email: "crash@example.com", password: "AnyPass123!" };

		// Make one of the DB calls throw
		(mocks.main.getUserByEmail as any).mockImplementation(() => {
			throw new Error("DB failure");
		});

		const res = await fastify.inject({
			method: "POST",
			url: "/accounts/register",
			payload,
		});

		expect(res.statusCode).toBe(500);
		const body = res.json();
		expect(body).toHaveProperty("message");
		expect(body.message).toMatch(/registration failed/i);
	});

	it("sets countryId correctly based on request IP", async () => {
		const testIp = "1.2.3.4";
		const testCountry = { country_id: 99 };
		(mocks.geoip.default.lookup as any).mockReturnValue({ country: "US" });
		(mocks.main.getCountryByCode as any).mockReturnValue(testCountry);

		const payload = { username: "userWithIp", email: "ip@example.com", password: "Aa1!aaaa!" };
		const res = await fastify.inject({ method: "POST", url: "/accounts/register", payload, ip: testIp });
		expect(res.statusCode).toBe(202);
		expect((mocks.main.getCountryByCode as any)).toHaveBeenCalledWith("US");

		// fallback on x-forwarded-for
		(mocks.geoip.default.lookup as any).mockClear();
		(mocks.main.getCountryByCode as any).mockClear();
		const resHeader = await fastify.inject({
			method: "POST",
			url: "/accounts/register",
			payload,
			headers: { "x-forwarded-for": testIp }
		});
		expect(resHeader.statusCode).toBe(202);
		expect((mocks.main.getCountryByCode as any)).toHaveBeenCalledWith("US");

		// geoip returns undefined
		(mocks.geoip.default.lookup as any).mockReturnValue(undefined);
		(mocks.main.getCountryByCode as any).mockClear();
		const resGeoUndefined = await fastify.inject({ method: "POST", url: "/accounts/register", payload, ip: testIp });
		expect(resGeoUndefined.statusCode).toBe(202);
		expect((mocks.main.getCountryByCode as any)).not.toHaveBeenCalled();

		// getCountryByCode returns undefined
		(mocks.geoip.default.lookup as any).mockReturnValue({ country: "US" });
		(mocks.main.getCountryByCode as any).mockReturnValue(undefined);
		const resCountryUndefined = await fastify.inject({ method: "POST", url: "/accounts/register", payload, ip: testIp });
		expect(resCountryUndefined.statusCode).toBe(202);
	});

	it("rate limits after too many attempts and returns Retry-After header", async () => {
		// Use a dedicated IP to avoid interference with other tests
		const testIp = "9.9.9.9";
		const payload = { username: "rateuser", email: "rate@example.com", password: "Aa1!aaaa!" };

		// RATE_LIMIT is 5 in route; perform 5 valid requests first
		for (let i = 0; i < 5; i++) {
			const r = await fastify.inject({ method: "POST", url: "/accounts/register", payload, ip: testIp });
			// expected accepted (202) for valid requests
			expect(r.statusCode).toBe(202);
		}

		// 6th request should be rate-limited
		const r6 = await fastify.inject({ method: "POST", url: "/accounts/register", payload, ip: testIp });
		expect(r6.statusCode).toBe(429);
		expect(r6.headers).toHaveProperty("retry-after");
		expect(r6.json()).toHaveProperty("message");
		expect(r6.json().message).toMatch(/Too many requests. Try again later./i);
	});

	it ("Returns 400 for password being too short or too long", async () => {
		const shortPayload = { username: "user123", email: "password@example.com", password: "short" };
		const resShort = await fastify.inject({ method: "POST", url: "/accounts/register", payload: shortPayload });
		expect(resShort.statusCode).toBe(400);
		expect(resShort.json()).toHaveProperty("message");
		expect(resShort.json().message).toMatch(/Invalid password format./i);

		const longPassword = "A".repeat(65); // 65 chars, exceeding max length
		const longPayload = { username: "user123", email: "password@example.com", password: longPassword };
		const resLong = await fastify.inject({ method: "POST", url: "/accounts/register", payload: longPayload });
		expect(resLong.statusCode).toBe(400);
		expect(resLong.json()).toHaveProperty("message");
		expect(resLong.json().message).toMatch(/Invalid password format./i);
	});
});