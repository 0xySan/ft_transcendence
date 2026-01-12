/**
 * @file connection.route.ts
 * @description Route to report the authenticated user's connection status.
 */

import { FastifyInstance } from 'fastify';
import { requireAuth } from "../../middleware/auth.middleware.js";
import { isUserInGame } from "../game/utils.js";
import { getActiveSessionsByUserId } from "../../db/wrappers/auth/sessions.js";
import { connectionSchema } from "../../plugins/swagger/schemas/connection.schema.js";

export function userConnectionRoutes(fastify: FastifyInstance) {
    fastify.get(
        '/:userId/connection',
        {
            preHandler: requireAuth,
            schema: connectionSchema,
            validatorCompiler: () => () => true,
        },
        async (request, reply) => {
            try {
                const callerSession = (request as any).session;
                if (!callerSession || !callerSession.user_id) return reply.status(401).send({ message: 'Unauthorized' });

                const params = (request as any).params as { userId?: string } | undefined;
                const targetUserId = params?.userId;
                if (!targetUserId || typeof targetUserId !== 'string') {
                    return reply.status(400).send({ message: 'Invalid user id' });
                }

                // If target user is in an active game -> online and in a game
                if (isUserInGame(targetUserId)) {
                    return reply.status(200).send({ status: 'online', detail: 'in_game' });
                }

                // Otherwise check target user's sessions last_request_at
                const sessions = getActiveSessionsByUserId(targetUserId);
                if (sessions && sessions.length > 0) {
                    let latest = 0;
                    for (const s of sessions) {
                        if (typeof s.last_request_at === 'number' && s.last_request_at > latest) latest = s.last_request_at;
                    }
                    const now = Math.floor(Date.now() / 1000);
                    const fiveMinutes = 60 * 5;
                    if (latest && (now - latest) <= fiveMinutes) {
                        return reply.status(200).send({ status: 'online', detail: 'recent_activity', lastRequestAt: latest });
                    }
                }

                return reply.status(200).send({ status: 'offline', detail: 'no_recent_activity' });
            } catch (err) {
                console.error('Error in GET /users/:userId/connection:', err);
                return reply.status(500).send({ message: 'Internal Server Error' });
            }
        }
    );
}
