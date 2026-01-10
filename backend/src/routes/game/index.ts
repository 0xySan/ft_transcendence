import { FastifyInstance } from "fastify";

import { gameStatsRoutes } from "./stats.route.js";

export function gameRoutes(fastify: FastifyInstance) {
	gameStatsRoutes(fastify);
}
