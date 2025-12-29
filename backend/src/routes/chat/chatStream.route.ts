import { FastifyInstance } from "fastify";
import { requirePartialAuth } from "../../middleware/auth.middleware.js";
import { addClient } from "../../utils/chatEvent.js";

export async function chatStreamRoutes(fastify: FastifyInstance) {
	fastify.get(
		"/stream",
		{ preHandler: requirePartialAuth },
		async (request, reply) => {
			const session = (request as any).session;
			const userId = session?.user_id;
			if (!userId) return reply.status(401).send({ message: "Unauthorized" });
			addClient(userId, reply);
			return reply; // keep the connection open
		}
	);
}