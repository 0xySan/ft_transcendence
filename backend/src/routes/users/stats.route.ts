/**
 * @file profile.ts
 * @description Route to get user stats info by user ID
 */

import { FastifyInstance } from "fastify";
import { getStatsByUserId } from '../../db/wrappers/main/index.js';

export async function statsRoutes(fastify: FastifyInstance) {
    fastify.get("/stats", async (request, reply) => {
        const query = request.query as { user_id?: string };
        if (!query.user_id) return reply.status(400).send({ error: "User ID missing" });

        const stats = getStatsByUserId(query.user_id);
        if (!stats) return reply.status(400).send({ error: "Stats missing" });

        const stats_params = { 
            game_played: stats.games_played,
            n_won: stats.games_won,
            n_lost: stats.games_lost,
            hours_play: stats.total_play_time,
            elo: stats.elo_rating,
            level: stats.level
        };

        return (reply.status(202).send(stats_params));
    })
}