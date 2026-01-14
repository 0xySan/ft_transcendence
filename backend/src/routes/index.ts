/**
 * @file index.ts
 * @description Centralized route registration for the Fastify server.
 */
import Fastify from "fastify";

import { oauthRoutes } from "./oauth/index.js";
import { userRoutes } from "./users/index.js";
import { healthRoute } from "./health.route.js";
import { chatRoutes } from "./chat/index.js";
import { gameRoutes, tournamentRoutes } from "./game/index.js";
import { friendsRoutes } from "./friends.route.js"

export async function registerRoutes(app: Fastify.FastifyInstance) {
	app.register(oauthRoutes, { prefix: '/api/oauth' });
	app.register(userRoutes, { prefix: '/api/users' });
	app.register(chatRoutes, { prefix: '/api/chat' });
	app.register(gameRoutes, { prefix: '/api/game' });
	app.register(tournamentRoutes, { prefix: '/api/tournament' });
	app.register(friendsRoutes, { prefix: '/api/friends' });
	app.register(healthRoute);
}