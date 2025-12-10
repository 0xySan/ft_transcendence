// src/routes/oauth/index.ts
import { FastifyInstance } from 'fastify';
import { oauthRoute } from './oauth.route.js';

export function oauthRoutes(fastify: FastifyInstance) {
	oauthRoute(fastify);
}
