/**
 * @file tournament-join.route.ts
 * @description This file contains the route for joining an existing tournament.
 */

import { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/auth.middleware.js";

import {
	activeTournaments,
	getTournamentByCode,
	isUserInGame,
	isUserInTournament,
	generateBracket,
} from "./utils.js";
import { wsPendingConnections } from "../../globals.js";

export function joinTournamentRoute(fastify: FastifyInstance) {
	fastify.post(
		'/tournament/join',
		{
			preHandler: requireAuth,
		},
		async (request, reply) => {
			const userId = (request as any).session.user_id;
			const body = request.body as { tournamentId?: string; code?: string };

			if (!userId)
				return reply.status(400).send({ error: 'User ID is required to join a tournament.' });

			if (isUserInGame(userId))
				return reply.status(400).send({ error: 'User is already in a game.' });

			if (isUserInTournament(userId))
				return reply.status(400).send({ error: 'User is already in a tournament.' });

			let tournamentId: string | null = null;

			if (body.tournamentId) {
				tournamentId = body.tournamentId;
			} else if (body.code) {
				tournamentId = getTournamentByCode(body.code.toUpperCase());
				if (!tournamentId)
					return reply.status(404).send({ error: 'Tournament with this code not found.' });
			} else {
				return reply.status(400).send({
					error: 'You must provide a tournamentId or code to join.',
				});
			}

			const tournament = activeTournaments.get(tournamentId);
			if (!tournament)
				return reply.status(404).send({ error: 'Tournament not found.' });

			if (tournament.status !== 'waiting')
				return reply.status(400).send({ error: 'Tournament is not accepting new players.' });

			if (tournament.players.size >= tournament.maxPlayers)
				return reply.status(400).send({ error: 'Tournament is full.' });

			tournament.players.add(userId);

			// Check if tournament is now full
			if (tournament.players.size === tournament.maxPlayers) {
				tournament.status = 'in-progress';
				// Generate bracket for all players
				tournament.bracket = generateBracket(Array.from(tournament.players));
			}

			return reply.status(200).send({
				tournamentId,
				code: tournament.code,
				playersJoined: tournament.players.size,
				maxPlayers: tournament.maxPlayers,
				status: tournament.status,
				readyToStart: tournament.status === 'in-progress',
			});
		}
	);
}
