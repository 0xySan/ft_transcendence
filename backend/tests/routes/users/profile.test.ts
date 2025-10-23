/**
 * tests/routes/users/profile.test.ts
 * Tests for userProfileRoutes
 */

import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";
import Fastify from "fastify";

// -> from tests/routes/users/profile.test.ts to src/... : ../../../src/...
vi.mock("../../../src/db/wrappers/main/users.js", () => ({
	getUserById: vi.fn(),
}));
vi.mock("../../../src/db/wrappers/main/userProfiles.js", () => ({
	getProfileByUserId: vi.fn(),
}));

// import the route AFTER the top-level vi.mock calls
import { userProfileRoutes } from "../../../src/routes/users/profile.js";

describe("/profile route", () => {
	let fastify: ReturnType<typeof Fastify>;
	let mocks: {
		getUserById: Mock;
		getProfileByUserId: Mock;
	};

	beforeEach(async () => {
		vi.clearAllMocks();
		vi.resetModules();

		fastify = Fastify();
		fastify.register(userProfileRoutes);

		// Dynamic imports -> same module ids as the vi.mock above
		const users = (await import("../../../src/db/wrappers/main/users.js")) as unknown as {
			getUserById: Mock;
		};
		const profiles = (await import("../../../src/db/wrappers/main/userProfiles.js")) as unknown as {
			getProfileByUserId: Mock;
		};

		mocks = {
			getUserById: users.getUserById,
			getProfileByUserId: profiles.getProfileByUserId,
		};
	});

	afterEach(async () => {
		try { await fastify.close(); } catch {}
		vi.resetAllMocks();
		vi.restoreAllMocks();
	});

	it("returns 400 if no id is provided", async () => {
		const res = await fastify.inject({ method: "GET", url: "/profile" });
		expect(res.statusCode).toBe(400);
		const body = JSON.parse(res.body);
		expect(body.error).toBe("Missing user ID in query");
	});

	it("returns 400 if id is invalid", async () => {
		const res = await fastify.inject({ method: "GET", url: "/profile?id=abc" });
		expect(res.statusCode).toBe(400);
		const body = JSON.parse(res.body);
		expect(body.error).toBe("Invalid user ID");
	});

	it("returns 404 if user is not found", async () => {
		mocks.getUserById.mockReturnValue(null);

		const res = await fastify.inject({ method: "GET", url: "/profile?id=42" });
		expect(res.statusCode).toBe(404);
		const body = JSON.parse(res.body);
		expect(body.error).toBe("User not found");
	});

	it("returns user and profile data when both exist", async () => {
		mocks.getUserById.mockReturnValue({
			user_id: 42,
			email: "test@example.com",
			role_id: 1,
			created_at: "2025-10-23",
			last_login: null,
		});
		mocks.getProfileByUserId.mockReturnValue({
			username: "tester",
			display_name: "Tester",
			profile_picture: "pic.jpg",
			country_id: 1,
			bio: "Hello world",
		});

		const res = await fastify.inject({ method: "GET", url: "/profile?id=42" });
		expect(res.statusCode).toBe(200);
		const body = JSON.parse(res.body);
		expect(body.user.user_id).toBe(42);
		expect(body.profile.username).toBe("tester");
	});

	it("returns null profile if user exists but profile does not", async () => {
		mocks.getUserById.mockReturnValue({
			user_id: 42,
			email: "test@example.com",
			role_id: 1,
			created_at: "2025-10-23",
			last_login: null,
		});
		mocks.getProfileByUserId.mockReturnValue(null);

		const res = await fastify.inject({ method: "GET", url: "/profile?id=42" });
		expect(res.statusCode).toBe(200);
		const body = JSON.parse(res.body);
		expect(body.profile).toBeNull();
	});

	it("returns 500 if an exception occurs", async () => {
		mocks.getUserById.mockImplementation(() => { throw new Error("DB error"); });

		const res = await fastify.inject({ method: "GET", url: "/profile?id=42" });
		expect(res.statusCode).toBe(500);
		const body = JSON.parse(res.body);
		expect(body.error).toBe("Internal server error");
	});
});
