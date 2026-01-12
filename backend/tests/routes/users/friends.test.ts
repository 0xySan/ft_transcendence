/**
 * tests/routes/users/friends.test.ts
 * Tests for friendsRoutes
 */

import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";
import Fastify from "fastify";
import { v7 as uuidv7 } from "uuid";

/**
 * Mocks (IMPORTANT: before route import)
 */
vi.mock("../../../src/middleware/auth.middleware.js", () => ({
	__esModule: true,
	requireAuth: vi.fn(async (request: any) => {
		// Fake authenticated session
		request.session = { user_id: "auth-user-id" };
	}),
}));

vi.mock("../../../src/db/wrappers/main/users/users.js", () => ({
	__esModule: true,
	getUserById: vi.fn(),
}));

vi.mock("../../../src/db/wrappers/main/users/userFriends.js", () => ({
	__esModule: true,
	sendFriendRequest: vi.fn(),
	getFriendRequest: vi.fn(),
	acceptFriendRequest: vi.fn(),
	rejectFriendRequest: vi.fn(),
	getFriends: vi.fn(),
	getPendingFriendRequests: vi.fn(),
	deleteFriendRelation: vi.fn(),
}));

// Import AFTER mocks
import { friendsRoutes } from "../../../src/routes/friends.route.js";

describe("/friends routes", () => {
	let fastify: ReturnType<typeof Fastify>;
	let mocks: {
		getUserById: Mock;
		sendFriendRequest: Mock;
		getFriendRequest: Mock;
		acceptFriendRequest: Mock;
		rejectFriendRequest: Mock;
		getFriends: Mock;
		getPendingFriendRequests: Mock;
		deleteFriendRelation: Mock;
	};

	beforeEach(async () => {
		vi.resetAllMocks();
		vi.resetModules();

		const users = await import("../../../src/db/wrappers/main/users/users.js") as any;
		const friends = await import("../../../src/db/wrappers/main/users/userFriends.js") as any;

		mocks = {
			getUserById: users.getUserById,
			sendFriendRequest: friends.sendFriendRequest,
			getFriendRequest: friends.getFriendRequest,
			acceptFriendRequest: friends.acceptFriendRequest,
			rejectFriendRequest: friends.rejectFriendRequest,
			getFriends: friends.getFriends,
			getPendingFriendRequests: friends.getPendingFriendRequests,
			deleteFriendRelation: friends.deleteFriendRelation,
		};

		fastify = Fastify();
		fastify.register(friendsRoutes, { prefix: "/friends" });
		await fastify.ready();
	});

	afterEach(async () => {
		try { await fastify.close(); } catch {}
		vi.restoreAllMocks();
	});

	/* ------------------------------------------------------------------ */
	/* POST /friends/request */
	/* ------------------------------------------------------------------ */

	it("returns 400 if targetUserId is missing", async () => {
		const res = await fastify.inject({
			method: "POST",
			url: "/friends/request",
			payload: {},
		});

		expect(res.statusCode).toBe(400);
		expect(JSON.parse(res.body).error).toBe("User ID and targetUserId are required.");
	});

	it("returns 400 if target user does not exist", async () => {
		mocks.getUserById.mockReturnValue(null);

		const res = await fastify.inject({
			method: "POST",
			url: "/friends/request",
			payload: { targetUserId: uuidv7() },
		});

		expect(res.statusCode).toBe(400);
		expect(JSON.parse(res.body).error).toBe("Target user doesn't exist.");
	});

	it("returns 409 if friend request already exists", async () => {
		mocks.getUserById.mockReturnValue({ user_id: "x" });
		mocks.getFriendRequest.mockReturnValue({});

		const res = await fastify.inject({
			method: "POST",
			url: "/friends/request",
			payload: { targetUserId: uuidv7() },
		});

		expect(res.statusCode).toBe(409);
	});

	it("returns 201 when friend request is sent", async () => {
		const targetId = uuidv7();

		mocks.getUserById.mockReturnValue({ user_id: targetId });
		mocks.getFriendRequest.mockReturnValue(null);
		mocks.sendFriendRequest.mockReturnValue({
			sender_user_id: "auth-user-id",
			target_user_id: targetId,
			status: "pending",
			created_at: "2025-01-01",
		});

		const res = await fastify.inject({
			method: "POST",
			url: "/friends/request",
			payload: { targetUserId: targetId },
		});

		expect(res.statusCode).toBe(201);
		const body = JSON.parse(res.body);
		expect(body.status).toBe("pending");
	});

	/* ------------------------------------------------------------------ */
	/* POST /friends/accept */
	/* ------------------------------------------------------------------ */

	it("accepts a friend request", async () => {
		mocks.acceptFriendRequest.mockReturnValue(true);

		const res = await fastify.inject({
			method: "POST",
			url: "/friends/accept",
			payload: { senderUserId: uuidv7() },
		});

		expect(res.statusCode).toBe(200);
		expect(JSON.parse(res.body).success).toBe(true);
	});

	it("returns 404 if accept fails", async () => {
		mocks.acceptFriendRequest.mockReturnValue(false);

		const res = await fastify.inject({
			method: "POST",
			url: "/friends/accept",
			payload: { senderUserId: uuidv7() },
		});

		expect(res.statusCode).toBe(404);
	});

	/* ------------------------------------------------------------------ */
	/* GET /friends */
	/* ------------------------------------------------------------------ */

	it("returns friends list", async () => {
		mocks.getFriends.mockReturnValue([{ sender_user_id: "a", target_user_id: "b" }]);

		const res = await fastify.inject({
			method: "GET",
			url: "/friends",
		});

		expect(res.statusCode).toBe(200);
		expect(JSON.parse(res.body).length).toBe(1);
	});

	/* ------------------------------------------------------------------ */
	/* GET /friends/pending */
	/* ------------------------------------------------------------------ */

	it("returns pending friend requests", async () => {
		mocks.getPendingFriendRequests.mockReturnValue([{ status: "pending" }]);

		const res = await fastify.inject({
			method: "GET",
			url: "/friends/pending",
		});

		expect(res.statusCode).toBe(200);
		expect(JSON.parse(res.body)[0].status).toBe("pending");
	});

	/* ------------------------------------------------------------------ */
	/* DELETE /friends/:userId */
	/* ------------------------------------------------------------------ */

	it("deletes a friend relation", async () => {
		mocks.deleteFriendRelation.mockReturnValue(true);

		const res = await fastify.inject({
			method: "DELETE",
			url: "/friends/" + uuidv7(),
		});

		expect(res.statusCode).toBe(200);
		expect(JSON.parse(res.body).success).toBe(true);
	});

	it("returns 404 if friend relation does not exist", async () => {
		mocks.deleteFriendRelation.mockReturnValue(false);

		const res = await fastify.inject({
			method: "DELETE",
			url: "/friends/" + uuidv7(),
		});

		expect(res.statusCode).toBe(404);
	});
});
