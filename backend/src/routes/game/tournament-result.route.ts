/**
 * @file tournament-result.route.ts
 * @description This file contains the route for recording match results and advancing tournaments.
 */

import { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/auth.middleware.js";

import {
	activeTournaments,
	isPlayerInTournament,
	recordMatchWinner,
	isCurrentRoundCompleted,
	advanceToNextRound,
} from "./utils.js";

export function tournamentResultRoute(fastify: FastifyInstance) {
	fastify.post(
		'/tournament/result',
		{
			preHandler: requireAuth,
		},
		async (request, reply) => {
			const userId = (request as any).session.user_id;
			const body = request.body as { tournamentId?: string; matchId?: string; winnerId?: string };

			if (!userId)
				return reply.status(400).send({ error: 'User ID is required.' });

			if (!body.tournamentId)
				return reply.status(400).send({ error: 'Tournament ID is required.' });

			if (!body.matchId)
				return reply.status(400).send({ error: 'Match ID is required.' });

			if (!body.winnerId)
				return reply.status(400).send({ error: 'Winner ID is required.' });

			const tournament = activeTournaments.get(body.tournamentId);
			if (!tournament)
				return reply.status(404).send({ error: 'Tournament not found.' });

			if (!isPlayerInTournament(userId, body.tournamentId))
				return reply.status(403).send({ error: 'You are not in this tournament.' });

			// Only tournament owner or admin should be able to record results
			// For now, we allow any player in the tournament to submit results
			// In production, you might want stricter validation
			const match = tournament.bracket.find(m => m.matchId === body.matchId);
			if (!match)
				return reply.status(404).send({ error: 'Match not found.' });

			if (match.player1Id !== body.winnerId && match.player2Id !== body.winnerId) {
				return reply.status(400).send({ error: 'Winner must be one of the match players.' });
			}

			// Record the winner
			const resultRecord = recordMatchWinner(body.tournamentId, body.matchId, body.winnerId);
			if (resultRecord !== true)
				return reply.status(400).send({ error: resultRecord });

			// Check if all matches in current round are completed
			const roundCompleted = isCurrentRoundCompleted(body.tournamentId);

			if (!roundCompleted) {
				return reply.status(202).send({
					message: 'Match result recorded. Waiting for other matches to complete.',
					matchId: body.matchId,
					winner: body.winnerId,
				});
			}

			// All matches in round completed - try to advance to next round
			const advanceResult = advanceToNextRound(body.tournamentId);

			if (advanceResult === 'Tournament completed') {
				const finalMatch = tournament.bracket.find(
					m => m.round === tournament.currentRound - 1 && m.winner
				);
				return reply.status(200).send({
					message: 'Tournament completed!',
					status: 'completed',
					champion: finalMatch?.winner,
					tournamentId: body.tournamentId,
				});
			}

			if (advanceResult === true) {
				const nextRoundMatches = tournament.bracket.filter(m => m.round === tournament.currentRound);
				return reply.status(200).send({
					message: 'Round completed! Advancing to next round.',
					currentRound: tournament.currentRound,
					totalRounds: Math.ceil(Math.log2(tournament.maxPlayers)),
					nextMatches: nextRoundMatches.map(m => ({
						matchId: m.matchId,
						player1Id: m.player1Id,
						player2Id: m.player2Id,
						player1Ready: m.player1Ready,
						player2Ready: m.player2Ready,
					})),
				});
			}

			return reply.status(400).send({ error: advanceResult });
		}
	);
}
