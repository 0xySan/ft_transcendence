/**
 * @file join.route.ts
 * @description This file contains the route for joining an existing game.
 */

import { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/auth.middleware.js";

import { addClient, closeClientById } from "../../utils/queueEvent.js"
import { addUserToGame, getGameByCode, isUserInGame, parseGameConfig } from "./utils.js";
import { assignGameToWorker, getGameIdByUser } from "../../game/workers/init.js"
import { activeGames, wsPendingConnections } from "../../globals.js";
import { handleGameMessage } from "../../game/sockets/handlers/startGame.js"
import { v7 as uuidv7 } from "uuid";
import { generateRandomToken } from "../../utils/crypto.js";
import { config } from "../../game/workers/game/game.types.js";
import { start } from "repl";
export const waitingUsers: string[] = [];

export function leaveQueue(userId: string): boolean {
    const index = waitingUsers.indexOf(userId);
	if (index === -1) return (false);
	waitingUsers.splice(index, 1);

    return (true);
}

export function findingGameRoute(fastify: FastifyInstance) {
    fastify.post(
        '/finding',
        {
            preHandler: requireAuth,
        },
    async (request, reply) => {
        const userId = (request as any).session.user_id;
        const session = (request as any).session;

        if (!userId) return reply.status(400).send({ error: 'User ID is required to join a game.' });
    
        if (waitingUsers.includes(userId)) return reply.status(400).send({ error: 'User already in waiting list.' });

        if (waitingUsers.length == 0) {
            const newGameId = uuidv7();
            const authToken = {token: generateRandomToken(32)};

            wsPendingConnections.set(authToken, {
                userId: userId,
                gameId: newGameId,
                expiresAt: Date.now() + 5 * 60 * 1000, // Expires in 5 minutes
            });
            waitingUsers.push(userId);

            const [valid, config] = parseGameConfig(null);
            if (!valid || typeof config === 'string' || !config.game) {
                wsPendingConnections.delete(authToken);
                return reply.status(400).send({ error: config });
            }
            
            while (getGameByCode(config.game.code) !== null || config.game.code === '') {
                // Generate a new 4-character code
                config.game.code = Math.random().toString(36).substring(2, 6).toUpperCase();
            }
            
            addUserToGame(userId, newGameId, config.game.code);

            assignGameToWorker(newGameId, userId, config as config);
            
            return ({ authToken: authToken.token });
        }
        else {
            const targetUser = waitingUsers.shift();
            if (!targetUser) return reply.status(500).send({ error: 'User is not exist.' });
            const gameId: string | null = getGameIdByUser(targetUser);
            if (!gameId) return reply.status(500).send({ error: 'Game is not exist.' });
            addUserToGame(userId, gameId);
            const authToken = {token: generateRandomToken(32), start: true};

            wsPendingConnections.set(authToken, {
                userId,
                gameId,
                expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
            });

            return ({ authToken: authToken.token });
            
        }
    });

    fastify.post(
        '/leave',
        {
            preHandler: requireAuth,
        },
    async (request, reply) => {
        const userId = (request as any).session.user_id;

		if (!userId) return reply.status(400).send({ error: "User ID is required." });

		if (!leaveQueue(userId)) return reply.status(400).send({ error: "User not in queue." });
        closeClientById(userId);

		return reply.status(200).send({ action: "removed_from_queue" });
    });
}
