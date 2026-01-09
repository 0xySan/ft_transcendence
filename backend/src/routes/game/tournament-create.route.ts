/**
 * @file tournament-create.route.ts
 * @description This file contains the route for creating a new tournament.
 */

import { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/auth.middleware.js";

import { v7 as uuidv7 } from "uuid";

import {
	isValidTournamentSize,
	isUserInTournament,
	isUserInGame,
} from "./utils.js";
import { parseGameConfig } from "./utils.js";
import { activeTournaments, Tournament } from "../../globals.js";

export function createTournamentRoute(fastify: FastifyInstance) {
	fastify.post(
		'/tournament/create',
		{
			preHandler: requireAuth,
		},
		async (request, reply) => {
			const userId = (request as any).session.user_id;
			const body = request.body as { maxPlayers?: number; config?: any };

			if (!userId)
				return reply.status(400).send({ error: 'User ID is required to create a tournament.' });

			if (isUserInGame(userId))
				return reply.status(400).send({ error: 'User is already in a game.' });

			if (isUserInTournament(userId))
				return reply.status(400).send({ error: 'User is already in a tournament.' });

			const maxPlayers = body.maxPlayers || 4;

			// Validate tournament size (must be power of 2)
			if (!isValidTournamentSize(maxPlayers)) {
				return reply.status(400).send({
					error: 'Tournament size must be a power of 2 (2, 4, 8, 16, 32, 64, 128, etc.)',
				});
			}

			// Parse game configuration if provided
			const [valid, config] = parseGameConfig(body.config || {});
			if (!valid || typeof config === 'string') {
				return reply.status(400).send({ error: config });
			}

			const tournamentId = uuidv7();
			const code = Math.random().toString(36).substring(2, 6).toUpperCase();

			const tournament: Tournament = {
				tournamentId,
				code,
				ownerId: userId,
				maxPlayers,
				players: new Set([userId]),
				bracket: [], // Will be generated when tournament starts
				status: 'waiting',
				currentRound: 0,
				config: config as Partial<import('../../game/workers/game/game.types.js').config>,
				createdAt: Date.now(),
				completedAt: null,
			};

			activeTournaments.set(tournamentId, tournament);

			return reply.status(201).send({
				tournamentId,
				code,
				maxPlayers,
				playersJoined: 1,
				status: 'waiting',
			});
		}
	);
}
