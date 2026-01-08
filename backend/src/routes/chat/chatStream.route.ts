import { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { addClient } from "../../utils/chatEvent.js";
import { rateLimiters } from "./rateLimit.js";

export async function chatStreamRoutes(fastify: FastifyInstance) {
	fastify.get(
		"/stream",
		{ preHandler: [requireAuth, rateLimiters.streaming] },
		async (request, reply) => {
			const session = (request as any).session;
			const userId = session?.user_id;
			if (!userId) return reply.status(401).send({ message: "Unauthorized" });
			try {
				addClient(userId, reply, session);
			} catch (error) {
				const message = (error as Error).message;
				if (message.includes('Too many connections')) {
					return reply.status(429).send({ message: "Too many connections from this user" });
				}
				if (message.includes('Server at connection capacity')) {
					return reply.status(503).send({ message: "Server at connection capacity" });
				}
				return reply.status(403).send({ message: "Forbidden" });
			}
			return reply; // keep the connection open
		}
	);
}