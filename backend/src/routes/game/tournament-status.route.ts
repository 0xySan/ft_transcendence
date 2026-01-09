/**
 * @file tournament-status.route.ts
 * @description This file contains the route for retrieving tournament status and bracket information.
 */

import { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/auth.middleware.js";

import { isPlayerInTournament } from "./utils.js";
import { activeTournaments } from "../../globals.js";

export function tournamentStatusRoute(fastify: FastifyInstance) {
	fastify.get(
		'/tournament/:tournamentId/status',
		{
			preHandler: requireAuth,
		},
		async (request, reply) => {
			const userId = (request as any).session.user_id;
			const { tournamentId } = request.params as { tournamentId: string };

			if (!userId)
				return reply.status(400).send({ error: 'User ID is required.' });

			const tournament = activeTournaments.get(tournamentId);
			if (!tournament)
				return reply.status(404).send({ error: 'Tournament not found.' });

			if (!isPlayerInTournament(userId, tournamentId))
				return reply.status(403).send({ error: 'You are not in this tournament.' });

			// Get current round matches
			const currentRoundMatches = tournament.bracket.filter(m => m.round === tournament.currentRound);

			// Find user's current match
			const userMatch = currentRoundMatches.find(
				m => m.player1Id === userId || m.player2Id === userId
			);

			return reply.status(200).send({
				tournamentId,
				status: tournament.status,
				maxPlayers: tournament.maxPlayers,
				playersJoined: tournament.players.size,
				currentRound: tournament.currentRound,
				totalRounds: Math.ceil(Math.log2(tournament.maxPlayers)),
				bracket: tournament.bracket.map(match => ({
					matchId: match.matchId,
					round: match.round,
					player1Id: match.player1Id,
					player2Id: match.player2Id,
					player1Ready: match.player1Ready,
					player2Ready: match.player2Ready,
					winner: match.winner,
					gameId: match.gameId,
				})),
				yourCurrentMatch: userMatch
					? {
							matchId: userMatch.matchId,
							opponent: userMatch.player1Id === userId ? userMatch.player2Id : userMatch.player1Id,
							yourReady: userMatch.player1Id === userId ? userMatch.player1Ready : userMatch.player2Ready,
							opponentReady:
								userMatch.player1Id === userId ? userMatch.player2Ready : userMatch.player1Ready,
							gameId: userMatch.gameId,
						}
					: null,
			});
		}
	);
}
