/**
 * @file tournament-ready.route.ts
 * @description This file contains the route for marking a player as ready in a tournament match and launching the game.
 */

import { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/auth.middleware.js";

import { v7 as uuidv7 } from "uuid";

import {
	areBothPlayersReady,
	isPlayerInTournament,
	markPlayerReady,
	addUserToGame,
	getGameByCode,
} from "./utils.js";
import { generateRandomToken } from "../../utils/crypto.js";
import { wsPendingConnections, activeTournaments, activeGames } from "../../globals.js";
import { assignGameToWorker } from "../../game/workers/init.js";
import { config } from "../../game/workers/game/game.types.js";

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

			const match = tournament.bracket.find(m => m.matchId === body.matchId);
			if (!match)
				return reply.status(400).send({ error: 'Match not found.' });

			if (!match.player1Id || !match.player2Id)
				return reply.status(400).send({ error: 'Match is not ready yet.' });

			if (!isPlayerInTournament(userId, body.tournamentId))
				return reply.status(403).send({ error: 'You are not in this tournament.' });

			if (match.player1Id !== userId && match.player2Id !== userId)
				return reply.status(403).send({ error: 'You are not in this match.' });

			const readyResult = markPlayerReady(body.tournamentId, body.matchId, userId);
			if (readyResult !== true)
				return reply.status(400).send({ error: readyResult });

			const bothReady = areBothPlayersReady(body.tournamentId, body.matchId);

			const gameId = match.gameId ?? uuidv7();
			match.gameId = gameId;

			for (const [token, pending] of wsPendingConnections.entries()) {
				if (pending.userId === userId && pending.gameId === gameId)
					wsPendingConnections.delete(token);
			}

			const gameOwner = match.player1Id ?? match.player2Id ?? userId;
			let gameCode = '';

			if (!activeGames.has(gameId)) {
				const baseConfig = tournament.config as config;
				const newGameConfig: config = {
					...baseConfig,
					game: {
						...(baseConfig.game ?? {}),
						mode: 'tournament',
						code: (baseConfig.game?.code ?? '').toUpperCase(),
					},
				};

				gameCode = newGameConfig.game.code;
				while (gameCode === '' || getGameByCode(gameCode) !== null)
					gameCode = Math.random().toString(36).substring(2, 6).toUpperCase();

				newGameConfig.game.code = gameCode;

				addUserToGame(userId, gameId, gameCode);
				assignGameToWorker(gameId, gameOwner, newGameConfig);
			} else {
				gameCode = activeGames.get(gameId)?.code || '';
				addUserToGame(userId, gameId);
			}

			const authToken = { token: generateRandomToken(32) } as { token: string; start?: boolean };
			if (bothReady) authToken.start = true;

			wsPendingConnections.set(authToken, {
				userId: userId,
				gameId: gameId,
				expiresAt: Date.now() + 5 * 60 * 1000,
			});

			if (!bothReady) {
				return reply.status(202).send({
					message: 'Player marked as ready. Waiting for opponent.',
					matchId: body.matchId,
					gameId: gameId,
					authToken: authToken.token,
				});
			}

			return reply.status(201).send({
				message: 'Match started! Both players ready.',
				gameId: gameId,
				matchId: body.matchId,
				code: gameCode,
				authToken: authToken.token,
				start: true,
			});
		}
		);
}
