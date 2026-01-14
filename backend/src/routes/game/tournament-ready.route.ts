/**
 * @file tournament-ready.route.ts
 * @description This file contains the route for marking a player as ready in a tournament match and launching the game.
 */

import { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/auth.middleware.js";

import { v7 as uuidv7 } from "uuid";

import {
	isPlayerInTournament,
	markPlayerReady,
	areBothPlayersReady,
} from "./utils.js";
import { addUserToGame } from "./utils.js";
import { generateRandomToken } from "../../utils/crypto.js";
import { wsPendingConnections, activeTournaments } from "../../globals.js";
import { assignGameToWorker } from "../../game/workers/init.js";
import { config } from "../../game/workers/game/game.types.js";
export const waitingUsers: string[] = [];

export function tournamentReadyRoute(fastify: FastifyInstance) {
	fastify.post(
		'/ready',
		{
			preHandler: requireAuth,
		},
		async (request, reply) => {
			const userId = (request as any).session.user_id;
			const body = request.body as { tournamentId?: string; matchId?: string };

			if (!userId)
				return reply.status(400).send({ error: 'User ID is required.' });

			if (!body.tournamentId)
				return reply.status(400).send({ error: 'Tournament ID is required.' });

			if (!body.matchId)
				return reply.status(400).send({ error: 'Match ID is required.' });

			const tournament = activeTournaments.get(body.tournamentId);
			if (!tournament)
				return reply.status(404).send({ error: 'Tournament not found.' });

			if (!isPlayerInTournament(userId, body.tournamentId))
				return reply.status(403).send({ error: 'You are not in this tournament.' });

			// Mark player as ready
			const readyResult = markPlayerReady(body.tournamentId, body.matchId, userId);
			if (readyResult !== true)
				return reply.status(400).send({ error: readyResult });

			// Check if both players are ready
			if (!areBothPlayersReady(body.tournamentId, body.matchId)) {
				return reply.status(202).send({
					message: 'Player marked as ready. Waiting for opponent.',
					matchId: body.matchId,
				});
			}

			// Both players are ready - create and launch the game
			const match = tournament.bracket.find(m => m.matchId === body.matchId);
			if (!match || !match.player1Id || !match.player2Id) {
				return reply.status(400).send({ error: 'Invalid match state.' });
			}

			const gameId = uuidv7();
			const authToken1 = generateRandomToken(32);
			const authToken2 = generateRandomToken(32);

			// Store pending connections for both players
			wsPendingConnections.set({token: authToken1}, {
				userId: match.player1Id,
				gameId: gameId,
				expiresAt: Date.now() + 5 * 60 * 1000, // Expires in 5 minutes
			});

			wsPendingConnections.set({token: authToken2}, {
				userId: match.player2Id,
				gameId: gameId,
				expiresAt: Date.now() + 5 * 60 * 1000, // Expires in 5 minutes
			});

			// Generate game code
			let gameCode = Math.random().toString(36).substring(2, 6).toUpperCase();

			// Add users to game
			addUserToGame(match.player1Id, gameId, gameCode);
			addUserToGame(match.player2Id, gameId);

			// Store game ID in match
			match.gameId = gameId;

			// Assign game to worker with tournament config
			assignGameToWorker(gameId, match.player1Id, tournament.config as config);

			return reply.status(201).send({
				message: 'Match started! Both players ready.',
				gameId: gameId,
				matchId: body.matchId,
				code: gameCode,
				authTokens: {
					[match.player1Id]: authToken1,
					[match.player2Id]: authToken2,
				},
			});
		}
	);
}
