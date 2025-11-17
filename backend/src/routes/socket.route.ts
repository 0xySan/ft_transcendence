/**
 * @file socket.ts
 * @description Route to connect to websocket
 */

import { FastifyInstance } from "fastify";

export async function socketRoutes(fastify: FastifyInstance) {
    fastify.get("/test", async (request, reply) => {
        return (reply.status(202).send({duck: "test"}));
    });
}