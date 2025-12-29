import { FastifyInstance } from "fastify";
import { requirePartialAuth } from "../../middleware/auth.middleware.js";
import {
  ensureDirectConversation,
} from "../../db/wrappers/chat/chatConversations.js";
import {
  addConversationMember,
} from "../../db/wrappers/chat/chatConversationMembers.js";

export async function chatDirectRoutes(fastify: FastifyInstance) {
    fastify.post(
		"/direct",
		{ preHandler: requirePartialAuth },
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

			addConversationMember(conversation.conversation_id, userId, "admin", "active");
			addConversationMember(conversation.conversation_id, targetUserId, "member", "active");

			return reply.status(201).send({ conversationId: conversation.conversation_id });
		}
	);
}