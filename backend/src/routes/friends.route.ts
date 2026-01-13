/**
 * @file friends.routes.ts
 * @description Friend system routes
 */

import { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth.middleware.js";
import { getUserById } from "../db/wrappers/main/users/users.js";

import {
	sendFriendRequest,
	getFriendRequest,
	acceptFriendRequest,
	rejectFriendRequest,
	getFriends,
	getPendingFriendRequests,
	getSentFriendRequests,
	deleteFriendRelation
} from "../db/wrappers/main/users/userFriends.js";

/**
 * Register friend routes
 */
export function friendsRoutes(fastify: FastifyInstance) {

	/**
	 * Send friend request
	 * POST /friends/request
	 */
	fastify.post(
		"/request",
		{ preHandler: requireAuth },
		async (request, reply) => {
			const body = request.body as { targetUserId?: string };
			const userId = (request as any).session.user_id;

			if (!userId || !body.targetUserId) {
				return reply.status(400).send({ error: "User ID and targetUserId are required." });
			}

			if (userId === body.targetUserId) {
				return reply.status(400).send({ error: "You cannot add yourself as friend." });
			}

			if (!getUserById(body.targetUserId)) {
				return reply.status(400).send({ error: "Target user doesn't exist." });
			}

			// Check if we already sent a request to them
			const existing = getFriendRequest(userId, body.targetUserId);
			if (existing) {
				return reply.status(409).send({ error: "Friend request already exists." });
			}

			const areFriends = getFriends(userId).some(friend => 
				(friend.target_user_id === body.targetUserId || friend.sender_user_id === body.targetUserId) 
				&& friend.status === 'accepted'
			);
			if (areFriends) {
				return reply.status(400).send({ error: "You are already friends with this user." });
			}

			// Check if they already sent a request to us - if so, accept it automatically
			const reverseRequest = getFriendRequest(body.targetUserId, userId);
			if (reverseRequest && reverseRequest.status === 'pending') {
				const success = acceptFriendRequest(body.targetUserId, userId);
				if (!success) {
					return reply.status(400).send({ error: "Failed to accept friend request." });
				}
				return reply.status(200).send({ 
					...reverseRequest,
					status: 'accepted',
					message: 'Friend request automatically accepted'
				});
			}

			const friend = sendFriendRequest(userId, body.targetUserId);
			if (!friend) {
				return reply.status(400).send({ error: "Failed to send friend request." });
			}

			return reply.status(201).send(friend);
		}
	);

	/**
	 * Accept friend request
	 * POST /friends/accept
	 */
	fastify.post(
		"/accept",
		{ preHandler: requireAuth },
		async (request, reply) => {
			const body = request.body as { senderUserId?: string };
			const userId = (request as any).session.user_id;

			if (!userId || !body.senderUserId) {
				return reply.status(400).send({ error: "senderUserId is required." });
			}

			const success = acceptFriendRequest(body.senderUserId, userId);
			if (!success) {
				return reply.status(404).send({
					error: "Friend request not found or already handled."
				});
			}

			return reply.send({ success: true });
		}
	);

	/**
	 * Reject friend request
	 * POST /friends/reject
	 */
	fastify.post(
		"/reject",
		{ preHandler: requireAuth },
		async (request, reply) => {
			const body = request.body as { senderUserId?: string };
			const userId = (request as any).session.user_id;

			if (!userId || !body.senderUserId) {
				return reply.status(400).send({ error: "senderUserId is required." });
			}

			const success = rejectFriendRequest(body.senderUserId, userId);
			if (!success) {
				return reply.status(404).send({
					error: "Friend request not found or already handled."
				});
			}

			return reply.send({ success: true });
		}
	);

	/**
	 * Get my friends
	 * GET /friends
	 */
	fastify.get(
		"/",
		{ preHandler: requireAuth },
		async (request) => {
			const userId = (request as any).session.user_id;
			return getFriends(userId);
		}
	);

	/**
	 * Get pending friend requests (received)
	 * GET /friends/pending
	 */
	fastify.get(
		"/pending",
		{ preHandler: requireAuth },
		async (request) => {
			const userId = (request as any).session.user_id;
			return getPendingFriendRequests(userId);
		}
	);

	/**
	 * Get sent friend requests
	 * GET /friends/sent
	 */
	fastify.get(
		"/sent",
		{ preHandler: requireAuth },
		async (request) => {
			const userId = (request as any).session.user_id;
			return getSentFriendRequests(userId);
		}
	);

	/**
	 * Delete friend or cancel request
	 * DELETE /friends/:userId
	 */
	fastify.delete(
		"/:userId",
		{ preHandler: requireAuth },
		async (request, reply) => {
			const userId = (request as any).session.user_id;
			const { userId: targetUserId } = request.params as { userId: string };

			if (!targetUserId) {
				return reply.status(400).send({ error: "Target user ID is required." });
			}

			const success = deleteFriendRelation(userId, targetUserId);
			if (!success) {
				return reply.status(404).send({ error: "Friend relation not found." });
			}

			return reply.send({ success: true });
		}
	);
}
