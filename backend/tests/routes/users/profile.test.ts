/**
 * tests/routes/users/profile.test.ts
 * Tests for userProfileRoutes with UUIDv7
 */

import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";
import Fastify from "fastify";
import { v7 as uuidv7 } from "uuid";

/**
 * Top-level mocks for the modules the route imports.
 * IMPORTANT: declare these vi.mock BEFORE importing the route.
 */
vi.mock("../../../src/db/wrappers/main/users/users.js", () => ({
	__esModule: true,
	getUserById: vi.fn(),
}));
vi.mock("../../../src/db/wrappers/main/users/userProfiles.js", () => ({
	__esModule: true,
	getProfileByUserId: vi.fn(),
}));
vi.mock("../../../src/db/wrappers/main/users/userRoles.js", () => ({
	__esModule: true,
	getRoleById: vi.fn(),
}));

// Import the route AFTER the mocks so module imports are replaced by mocks.
import { userProfileRoutes } from "../../../src/routes/users/profile.route.js";

describe("/profile route", () => {
	let fastify: ReturnType<typeof Fastify>;
	let mocks: {
		getUserById: Mock;
		getProfileByUserId: Mock;
		getRoleById: Mock;
	};

	beforeEach(async () => {
		// Reset mock state and modules between tests to avoid leakage
		vi.resetAllMocks();
		vi.resetModules();

		// Re-import the mocked modules to get their mock functions
		const users = (await import("../../../src/db/wrappers/main/users/users.js")) as unknown as {
			getUserById: Mock;
		};
		const profiles = (await import("../../../src/db/wrappers/main/users/userProfiles.js")) as unknown as {
			getProfileByUserId: Mock;
		};
		const roles = (await import("../../../src/db/wrappers/main/users/userRoles.js")) as unknown as {
			getRoleById: Mock;
		};

		mocks = {
			getUserById: users.getUserById,
			getProfileByUserId: profiles.getProfileByUserId,
			getRoleById: roles.getRoleById,
		};

		// Default behaviour for role lookup in tests (avoid DB calls)
		mocks.getRoleById.mockReturnValue({ role_id: 1, role_name: "User" });

		// Setup fastify and register the route plugin, then wait ready
		fastify = Fastify();
		fastify.register(userProfileRoutes);
		await fastify.ready();
	});

	afterEach(async () => {
		try { await fastify.close(); } catch (_) {}
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
		const uuid = uuidv7();
		mocks.getUserById.mockReturnValue(null);

		const res = await fastify.inject({ method: "GET", url: "/profile?id=" + uuid });
		expect(res.statusCode).toBe(404);
		const body = JSON.parse(res.body);
		expect(body.error).toBe("User not found");
	});

	it("returns user and profile data when both exist", async () => {
		const uuid = uuidv7();
		mocks.getUserById.mockReturnValue({
			user_id: uuid,
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

		const res = await fastify.inject({ method: "GET", url: "/profile?id=" + uuid });
		expect(res.statusCode).toBe(200);
		const body = JSON.parse(res.body);
		expect(body.user.user_id).toBe(uuid);
		expect(body.profile.username).toBe("tester");
	});

	it("returns null profile if user exists but profile does not", async () => {
		const uuid = uuidv7();
		mocks.getUserById.mockReturnValue({
			user_id: uuid,
			email: "test@example.com",
			role_id: 1,
			created_at: "2025-10-23",
			last_login: null,
		});
		mocks.getProfileByUserId.mockReturnValue(null);

		const res = await fastify.inject({ method: "GET", url: "/profile?id=" + uuid });
		expect(res.statusCode).toBe(200);
		const body = JSON.parse(res.body);
		expect(body.profile).toBeNull();
	});

	it("returns 500 if an exception occurs", async () => {
		const uuid = uuidv7();
		mocks.getUserById.mockImplementation(() => { throw new Error("DB error"); });

		const res = await fastify.inject({ method: "GET", url: "/profile?id=" + uuid });
		expect(res.statusCode).toBe(500);
		const body = JSON.parse(res.body);
		expect(body.error).toBe("Internal server error");
	});
});