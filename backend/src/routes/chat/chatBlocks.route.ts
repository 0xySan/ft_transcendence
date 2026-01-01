import { FastifyInstance } from "fastify";
import { requirePartialAuth } from "../../middleware/auth.middleware.js";
import { blockUser, unblockUser, listBlockedUsers, type ChatUserBlock } from "../../db/wrappers/chat/chatUserBlocks.js";

export async function chatBlocksRoutes(fastify: FastifyInstance) {
	fastify.get(
		"/blocks",
		{ preHandler: requirePartialAuth },
		async (request, reply) => {
			const session = (request as any).session;
			const userId = session?.user_id;
			if (!userId) return reply.status(401).send({ message: "Unauthorized" });

			const blocked = listBlockedUsers(userId).map((b: ChatUserBlock) => b.blocked_id);
			return reply.send({ blocked });
		}
	);

	fastify.post(
		"/blocks/:targetId",
		{ preHandler: requirePartialAuth },
		async (request, reply) => {
			const session = (request as any).session;
			const userId = session?.user_id;
			if (!userId) return reply.status(401).send({ message: "Unauthorized" });

			const targetId = (request.params as any).targetId as string;
			if (!targetId) return reply.status(400).send({ message: "targetId is required" });
			if (targetId === userId) return reply.status(400).send({ message: "Cannot block yourself" });

			const ok = blockUser(userId, targetId);
			return reply.send({ blocked: ok });
		}
	);

	fastify.delete(
		"/blocks/:targetId",
		{ preHandler: requirePartialAuth },
		async (request, reply) => {
			const session = (request as any).session;
			const userId = session?.user_id;
			if (!userId) return reply.status(401).send({ message: "Unauthorized" });

			const targetId = (request.params as any).targetId as string;
			if (!targetId) return reply.status(400).send({ message: "targetId is required" });

			const ok = unblockUser(userId, targetId);
			return reply.send({ unblocked: ok });
		}
	);
}