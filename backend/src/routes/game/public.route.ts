import { FastifyInstance } from "fastify";
import { getPublicGame } from "./utils.js";
import { requireAuth } from "../../middleware/auth.middleware.js";

export function gamesPublicRoute(fastify: FastifyInstance) {
	fastify.get(
		"/",
		{preHandler: requireAuth,},
		async (request, reply) => {

			const games = getPublicGame();

			return reply.status(200).send({
				count: games.length,
				games
			});
		}
	);
}
