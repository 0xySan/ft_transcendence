/**
 * @file join.route.ts
 * @description This file contains the route for joining an existing game.
 */

import { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/auth.middleware.js";

import { addUserToGame, getGameByCode, isUserInGame } from "./utils.js";
import { activeGames, wsPendingConnections } from "../../globals.js";

const waitingUsers: string[] = [];

export function findingGameRoute(fastify: FastifyInstance) {
    fastify.post(
        '/finding',
        {
            preHandler: requireAuth,
        },
    async (request, reply) => {
        const userId = (request as any).session.user_id;

        if (!userId) return reply.status(400).send({ error: 'User ID is required to join a game.' });
    
        if (waitingUsers.includes(userId)) return reply.status(400).send({ error: 'User already in waiting list.' });

        if (waitingUsers.length >= 1) {
            const targetUser = waitingUsers.shift();
        }
        else waitingUsers.push(userId);

        return reply.status(202).send({ action: "User has been added" });
    });

    fastify.post(
        '/leave',
        {
            preHandler: requireAuth,
        },
    async (request, reply) => {
        const userId = (request as any).session.user_id;

		if (!userId) return reply.status(400).send({ error: "User ID is required." });

		const index = waitingUsers.indexOf(userId);

		if (index === -1) return reply.status(400).send({ error: "User not in queue." });

	    waitingUsers.splice(index, 1);

		return reply.status(200).send({ action: "removed_from_queue" });
    });
}
