/**
 * @file index.ts
 * @description This file contains the main game routes.
 */

import { FastifyInstance } from "fastify";
import { createNewGameRoute } from "./new.route.js";
import { joinGameRoute } from "./join.route.js";
import { gameSettingsRoute } from "./settings.route.js";
import { gamesPublicRoute } from "./public.route.js";
import { createTournamentRoute } from "./tournament-create.route.js";
import { joinTournamentRoute } from "./tournament-join.route.js";
import { tournamentReadyRoute } from "./tournament-ready.route.js";
import { tournamentStatusRoute } from "./tournament-status.route.js";
import { tournamentResultRoute } from "./tournament-result.route.js";
import { listPublicTournamentsRoute } from "./tournament-list.route.js";
import { findingGameRoute } from "./finding.route.js";
import { gameStatsRoutes } from "./stats.route.js";

export function gameRoutes(fastify: FastifyInstance) {
	// Standard game routes
	createNewGameRoute(fastify);
	joinGameRoute(fastify);
	gameSettingsRoute(fastify);
	gamesPublicRoute(fastify);

	// Tournament routes
	createTournamentRoute(fastify);
	joinTournamentRoute(fastify);
	tournamentReadyRoute(fastify);
	tournamentStatusRoute(fastify);
	tournamentResultRoute(fastify);
	listPublicTournamentsRoute(fastify);
	findingGameRoute(fastify);
	gameStatsRoutes(fastify);
}