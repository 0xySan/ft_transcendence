import { FastifyInstance } from "fastify";
import {chatBlocksRoutes } from "./chatBlocks.route.js";
import { chatStreamRoutes } from "./chatStream.route.js";
import { chatConversationRoutes } from "./chatConversations.route.js";
import { chatDirectRoutes } from "./chatDirect.route.js";

export function chatRoutes(fastify: FastifyInstance) {
	chatStreamRoutes(fastify);
	chatConversationRoutes(fastify);
	chatDirectRoutes(fastify);
	chatBlocksRoutes(fastify);
}
