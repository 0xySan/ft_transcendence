/**
 * @file backend/tests/routes/users/accounts/register.test.ts
 * @description Optimized and corrected tests for the user account registration route.
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
		// Reset module registry so doMock works cleanly
		vi.resetModules();
		vi.restoreAllMocks();

		// --- Mocks ---
		// geoip-lite mock
		vi.doMock("geoip-lite", () => ({
			__esModule: true,
			default: { lookup: vi.fn() },
		}));

		// main DB wrappers mock
		vi.doMock("../../../../src/db/wrappers/main/index.js", () => ({
			__esModule: true,
			createUser: vi.fn(),
			getUserByEmail: vi.fn(),
			createProfile: vi.fn(),
			getProfileByUsername: vi.fn(),
			getCountryByCode: vi.fn(),
			getRoleByName: vi.fn().mockReturnValue({ role_id: 1, role_name: "unverified" }),
		}));

		// auth DB wrappers mock
		vi.doMock("../../../../src/db/wrappers/auth/index.js", () => ({
			__esModule: true,
			getOauthAccountByProviderAndUserId: vi.fn(),
			createOauthAccount: vi.fn(),
			createEmailVerification: vi.fn().mockResolvedValue({ email: "user@example.com", token: "token123" }),
		}));

		// crypto utils mock - deterministic and no env/bcrypt dependency
		vi.doMock("../../../../src/utils/crypto.js", () => {
			// deterministic token + encrypt/decrypt pair for tests
			return {
				__esModule: true,
				hashPassword: vi.fn(async (plain: string) => `hashed_test_${plain}`),
				verifyPassword: vi.fn(async (plain: string, hashed: string) => hashed === `hashed_test_${plain}`),
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

		// userData mock
		vi.doMock("../../../../src/utils/userData.js", () => ({
			__esModule: true,
			saveAvatarFromUrl: vi.fn(),
		}));

		// Import route AFTER the mocks are registered
		const mod = await import("../../../../src/routes/users/accounts/register.route.js");
		const { newUserAccountRoutes } = mod;

		// Setup fastify with the route
		fastify = Fastify();
		fastify.register(newUserAccountRoutes);
		await fastify.ready();

		// Import mocked modules so tests can inspect mock calls
		const geoip = await import("geoip-lite");
		const main = await import("../../../../src/db/wrappers/main/index.js");
		const auth = await import("../../../../src/db/wrappers/auth/index.js");
		const crypto = await import("../../../../src/utils/crypto.js");
		const userData = await import("../../../../src/utils/userData.js");

		// default createUser & hashPassword behaviour
		(main.createUser as any).mockImplementation((email: string) => ({ user_id: 1, email, role_id: 1 }));
		(crypto.hashPassword as any).mockResolvedValue("hashedpwd");

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
		expect(res.json()).toHaveProperty("error", "Username is required");
	});

	it("returns 400 for invalid email", async () => {
		const payload = { username: "user123", email: "bad.@email.com", password: "Aa1!aaaa" };
		const res = await fastify.inject({ method: "POST", url: "/accounts/register", payload });
		expect(res.statusCode).toBe(400);
		expect(res.json()).toHaveProperty("error", "Invalid email format");
	});

	it("returns 400 when neither password nor oauth provided", async () => {
		const payload = { username: "user123", email: "user@example.com" };
		const res = await fastify.inject({ method: "POST", url: "/accounts/register", payload });
		expect(res.statusCode).toBe(400);
		expect(res.json()).toHaveProperty("error", "Either password or OAuth data is required");
	});

	it("returns 409 if email already exists", async () => {
		(mocks.main.getUserByEmail as any).mockReturnValue({ user_id: 1 });
		const payload = { username: "user123", email: "exists@example.com", password: "Aa1!aaaa" };
		const res = await fastify.inject({ method: "POST", url: "/accounts/register", payload });
		expect(res.statusCode).toBe(409);
		expect(res.json()).toHaveProperty("error", "User with this email already exists");
	});

	it("returns 409 if username already taken", async () => {
		(mocks.main.getProfileByUsername as any).mockReturnValue({ profile_id: 5 });
		const payload = { username: "taken_name", email: "user2@example.com", password: "Aa1!aaaa" };
		const res = await fastify.inject({ method: "POST", url: "/accounts/register", payload });
		expect(res.statusCode).toBe(409);
		expect(res.json()).toHaveProperty("error", "Username is already taken");
	});

	it("creates user with password and returns 201", async () => {
		const payload = { username: "newuser", email: "new@example.com", password: "Aa1!aaaa!" };
		const res = await fastify.inject({ method: "POST", url: "/accounts/register", payload });
		expect(res.statusCode).toBe(201);
		const body = res.json();
		expect(body).toHaveProperty("message", "User account created successfully");
		expect(body.user).toMatchObject({ user_id: 1, email: "new@example.com", role_id: 1 });
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
		expect(res.statusCode).toBe(201);
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
		expect(res.statusCode).toBe(201);
		expect((mocks.main.createProfile as any)).toHaveBeenCalledWith(1, "userNoAvatar", "userNoAvatar", undefined, undefined);
	});

	it("returns 500 if createUser fails", async () => {
		(mocks.main.createUser as any).mockReturnValue(null);
		const payload = { username: "failuser", email: "failuser@example.com", password: "Aa1!aaaa!" };
		const res = await fastify.inject({ method: "POST", url: "/accounts/register", payload });
		expect(res.statusCode).toBe(500);
		expect(res.json()).toHaveProperty("error", "Failed to create user");
	});

	it("sets countryId correctly based on request IP", async () => {
		const testIp = "1.2.3.4";
		const testCountry = { country_id: 99 };
		(mocks.geoip.default.lookup as any).mockReturnValue({ country: "US" });
		(mocks.main.getCountryByCode as any).mockReturnValue(testCountry);

		const payload = { username: "userWithIp", email: "ip@example.com", password: "Aa1!aaaa!" };
		const res = await fastify.inject({ method: "POST", url: "/accounts/register", payload, ip: testIp });
		expect(res.statusCode).toBe(201);
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
		expect(resHeader.statusCode).toBe(201);
		expect((mocks.main.getCountryByCode as any)).toHaveBeenCalledWith("US");

		// geoip returns undefined
		(mocks.geoip.default.lookup as any).mockReturnValue(undefined);
		(mocks.main.getCountryByCode as any).mockClear();
		const resGeoUndefined = await fastify.inject({ method: "POST", url: "/accounts/register", payload, ip: testIp });
		expect(resGeoUndefined.statusCode).toBe(201);
		expect((mocks.main.getCountryByCode as any)).not.toHaveBeenCalled();

		// getCountryByCode returns undefined
		(mocks.geoip.default.lookup as any).mockReturnValue({ country: "US" });
		(mocks.main.getCountryByCode as any).mockReturnValue(undefined);
		const resCountryUndefined = await fastify.inject({ method: "POST", url: "/accounts/register", payload, ip: testIp });
		expect(resCountryUndefined.statusCode).toBe(201);
	});
});
