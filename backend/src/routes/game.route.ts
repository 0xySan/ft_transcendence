/**
 * @file socket.ts
 * @description TODO met un nom
 */

import { FastifyInstance } from "fastify";
import { generateRandomToken } from '../utils/crypto.js';
import { sv_game, position } from '../sockets/interfaces/interfaces.type.js';

export async function gameRoutes(fastify: FastifyInstance) {
    fastify.get("/game", async (request, reply) => {
        return (reply.status(202).send({token: generateRandomToken(32)}));
    });

    fastify.post("/game", async (request, reply) => {
        const game = request.body as sv_game;

        return (reply.status(202).send({game}));
    });
}