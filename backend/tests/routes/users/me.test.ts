/**
 * @file backend/tests/routes/users/me.route.test.ts
 * @description Tests for /me route
 */

import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";
import Fastify from "fastify";

// -------------------- MOCKS --------------------
vi.mock("../../../src/middleware/auth.middleware", () => ({
	__esModule: true,
	requirePartialAuth: vi.fn((req, reply, done) => {
		(req as any).session = { user_id: "user123", ip: "127.0.0.1" };
		done();
	}),
}));

vi.mock("../../../src/db/index", () => ({
	__esModule: true,
	getUserById: vi.fn(),
	getProfileByUserId: vi.fn(),
	getCountryById: vi.fn(),
}));

import { userMeRoutes } from "../../../src/routes/users/me.route";
import { getUserById, getProfileByUserId, getCountryById } from "../../../src/db/index";

describe("/me route", () => {
	let fastify: ReturnType<typeof Fastify>;

	beforeEach(async () => {
		vi.resetAllMocks();
		fastify = Fastify();
		fastify.register(userMeRoutes);
		await fastify.ready();
	});

	afterEach(async () => {
		try {
			await fastify.close();
		} catch {}
	});

	it("returns 404 if user not found", async () => {
		(getUserById as Mock).mockReturnValue(null);

		const res = await fastify.inject({ method: "GET", url: "/me" });
		expect(res.statusCode).toBe(404);
		const body = JSON.parse(res.body);
		expect(body.message).toBe("User not found");
	});

	it("returns user with profile and country data", async () => {
		(getUserById as Mock).mockReturnValue({
			user_id: "user123",
			email: "test@example.com",
			created_at: "2025-12-08T00:00:00Z",
		});

		(getProfileByUserId as Mock).mockReturnValue({
			username: "testuser",
			display_name: "Test User",
			profile_picture: "/path/to/pic.png",
			bio: "Hello world",
			country_id: 1,
		});

		(getCountryById as Mock).mockReturnValue({
			country_id: 1,
			country_name: "Testland",
			country_code: "TL",
			flag_svg_path: "/flags/tl.svg",
		});

		const res = await fastify.inject({ method: "GET", url: "/me" });
		expect(res.statusCode).toBe(200);

		const body = JSON.parse(res.body);
		expect(body.user.id).toBe("user123");
		expect(body.user.email).toBe("test@example.com");
		expect(body.user.profile.username).toBe("testuser");
		expect(body.user.profile.country.name).toBe("Testland");
	});

	it("returns user with null profile if profile not found", async () => {
		(getUserById as Mock).mockReturnValue({
			user_id: "user123",
			email: "test@example.com",
			created_at: "2025-12-08T00:00:00Z",
		});

		(getProfileByUserId as Mock).mockReturnValue(null);

		const res = await fastify.inject({ method: "GET", url: "/me" });
		expect(res.statusCode).toBe(200);

		const body = JSON.parse(res.body);
		expect(body.user.profile).toBeNull();
	});

	it("returns 500 if DB throws", async () => {
		(getUserById as Mock).mockImplementation(() => { throw new Error("DB error"); });

		const res = await fastify.inject({ method: "GET", url: "/me" });
		expect(res.statusCode).toBe(500);

		const body = JSON.parse(res.body);
		expect(body.message).toBe("Internal Server Error");
	});
});
