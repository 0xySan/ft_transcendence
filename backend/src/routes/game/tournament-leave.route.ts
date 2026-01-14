/**
 * @file tournament-leave.route.ts
 * @description This file contains the route for leaving a tournament.
 */

import { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/auth.middleware.js";

import {
	isPlayerInTournament,
} from "./utils.js";

import { activeTournaments } from "../../globals.js";

export function leaveTournamentRoute(fastify: FastifyInstance) {
	fastify.post(
		'/leave',
		{
			preHandler: requireAuth,
		},
		async (request, reply) => {
			const userId = (request as any).session.user_id;
			const body = request.body as { tournamentId?: string };

			if (!userId)
				return reply.status(400).send({ error: 'User ID is required to leave a tournament.' });

			if (!body.tournamentId)
				return reply.status(400).send({ error: 'Tournament ID is required.' });

			const tournament = activeTournaments.get(body.tournamentId);
			if (!tournament)
				return reply.status(404).send({ error: 'Tournament not found.' });

			if (!isPlayerInTournament(userId, body.tournamentId))
				return reply.status(403).send({ error: 'You are not in this tournament.' });

			// Cannot leave if tournament has already started
			if (tournament.status !== 'waiting') {
				return reply.status(400).send({
					error: 'Cannot leave a tournament that has already started.',
				});
			}

			// Remove player from tournament
			tournament.players.delete(userId);

			// If tournament is now empty, delete it
			if (tournament.players.size === 0) {
				activeTournaments.delete(body.tournamentId);
				return reply.status(200).send({
					message: 'Tournament left and deleted (no players remaining).',
					tournamentId: body.tournamentId,
					playersRemaining: 0,
				});
			}

			return reply.status(200).send({
				message: 'Successfully left the tournament.',
				tournamentId: body.tournamentId,
				playersRemaining: tournament.players.size,
				maxPlayers: tournament.maxPlayers,
				status: tournament.status,
			});
		}
	);
}
