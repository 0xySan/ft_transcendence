/**
 * @file tournament-list.route.ts
 * @description This file contains the route for listing public tournaments.
 */

import { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { activeTournaments } from "../../globals.js";

export function listPublicTournamentsRoute(fastify: FastifyInstance) {
	fastify.get(
		'/tournament/list',
		{
			preHandler: requireAuth,
		},
		async (request, reply) => {
			const userId = (request as any).session.user_id;

			if (!userId)
				return reply.status(400).send({ error: 'User ID is required.' });

			// Filter only public tournaments that are waiting for players
			const publicTournaments = Array.from(activeTournaments.values())
				.filter(tournament => tournament.visibility === "public" && tournament.status === "waiting")
				.map(tournament => ({
					tournamentId: tournament.tournamentId,
					ownerId: tournament.ownerId,
					maxPlayers: tournament.maxPlayers,
					playersJoined: tournament.players.size,
					status: tournament.status,
					createdAt: tournament.createdAt,
				}));

			return reply.status(200).send({
				tournaments: publicTournaments,
			});
		}
	);
}
