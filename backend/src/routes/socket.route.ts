/**
 * @file socket.ts
 * @description Route to connect to websocket
 */

import { FastifyInstance } from "fastify";

export async function socketRoutes(fastify: FastifyInstance) {
    fastify.get("/test", async () => ({ status: "ok", msg: "Route test OK" }));
}