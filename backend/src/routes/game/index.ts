/**
 * @file index.ts
 * @description This file contains the main game routes.
 */

import { FastifyInstance } from "fastify";
import { createNewGameRoute } from "./new.route.js";
import { joinGameRoute } from "./join.route.js";
import { gameSettingsRoute } from "./settings.route.js";
import { gamesPublicRoute } from "./public.route.js";

export function gameRoutes(fastify: FastifyInstance) {
	createNewGameRoute(fastify);
	joinGameRoute(fastify);
	gameSettingsRoute(fastify);
	gamesPublicRoute(fastify);
}