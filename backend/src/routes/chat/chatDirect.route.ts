import { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/auth.middleware.js";
import {
  ensureDirectConversation,
} from "../../db/wrappers/chat/chatConversations.js";
import {
  addConversationMember,
	getConversationMember,
} from "../../db/wrappers/chat/chatConversationMembers.js";
import { rateLimiters } from "./rateLimit.js";

export async function chatDirectRoutes(fastify: FastifyInstance) {
    fastify.post(
		"/direct",
		{ preHandler: [requireAuth, rateLimiters.messaging] },
		async (request, reply) => {
			const session = (request as any).session;
			const userId = session?.user_id;
			if (!userId) return reply.status(401).send({ message: "Unauthorized" });

			const body = request.body as { targetUserId?: string };
			const targetUserId = body?.targetUserId;
			if (!targetUserId || typeof targetUserId !== "string") {
				return reply.status(400).send({ message: "targetUserId is required" });
			}
			if (targetUserId === userId) return reply.status(400).send({ message: "Cannot create direct conversation with yourself" });

			const conversation = ensureDirectConversation(userId, targetUserId, userId);
			if (!conversation) return reply.status(500).send({ message: "Failed to create conversation" });

			// Add both users to the conversation on first creation
			const userExists = getConversationMember(conversation.conversation_id, userId);
			if (!userExists)
			{
				const added = addConversationMember(conversation.conversation_id, userId);
				if (!added)
					return reply.status(500).send({ message: "Failed to add user to conversation" });
			}

			const targetExists = getConversationMember(conversation.conversation_id, targetUserId);
			if (!targetExists)
			{
				const added = addConversationMember(conversation.conversation_id, targetUserId);
				if (!added)
					return reply.status(500).send({ message: "Failed to add target user to conversation" });
			}

			return reply.status(201).send({ conversationId: conversation.conversation_id });
		}
	);
}