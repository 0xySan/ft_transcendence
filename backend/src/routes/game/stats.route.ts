import { FastifyInstance } from "fastify";

import { requireAuth } from "../../middleware/auth.middleware.js";
import {
	createStats,
	getParticipantsByGameId,
	getStatsByUserId,
} from "../../db/index.js";
import { getRecentGamesByPlayer } from "../../db/wrappers/main/games/games.js";

export async function gameStatsRoutes(fastify: FastifyInstance) {
	fastify.post(
		"/stats",
		{ preHandler: requireAuth },
		async (request, reply) => {
			try {
				const session = (request as any).session;
				const body = request.body as { userId?: unknown } | undefined;
				const requestedUserId = typeof body?.userId === "string" && body.userId.trim().length > 0
					? body.userId.trim()
					: undefined;

				const userId = requestedUserId ?? (session?.user_id as string | undefined);
				if (!userId) return reply.status(400).send({ message: "Invalid or missing userId" });

				let stats = getStatsByUserId(userId);
				if (!stats) {
					stats = createStats(userId);
				}
				if (!stats) {
					return reply.status(500).send({ message: "Unable to load stats" });
				}

				const queryLimit = Number((request.query as Record<string, unknown> | undefined)?.limit);
				const limit = Number.isFinite(queryLimit)
					? Math.min(Math.max(Math.trunc(queryLimit as number), 1), 20)
					: 5;

				const games = getRecentGamesByPlayer(userId, limit);
				const recentGames = games.map(game => {
					const participants = getParticipantsByGameId(game.game_id);
					return {
						id: game.game_id,
						createdAt: game.created_at,
						duration: game.duration ?? null,
						mode: game.mode,
						status: game.status,
						scoreLimit: game.score_limit,
						winnerId: game.winner_id ?? null,
						participants: participants.map(p => ({
							userId: p.user_id,
							team: p.team ?? null,
							score: p.score,
							result: p.result ?? null,
						})),
					};
				});

				const winRate = stats.games_played > 0
					? Number(((stats.games_won / stats.games_played) * 100).toFixed(1))
					: 0;

				return reply.status(200).send({
					stats: {
						gamesPlayed: stats.games_played,
						gamesWon: stats.games_won,
						gamesLost: stats.games_lost,
						eloRating: stats.elo_rating,
						level: stats.level,
						rank: stats.rank,
						totalPlayTime: stats.total_play_time,
						winRate,
					},
					recentGames,
				});
			} catch (error) {
				request.log.error({ err: error }, "Failed to fetch game stats");
				return reply.status(500).send({ message: "Internal Server Error" });
			}
		}
	);
}

export default gameStatsRoutes;
