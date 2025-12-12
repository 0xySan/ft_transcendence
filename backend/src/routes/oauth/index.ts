// src/routes/oauth/index.ts
import { FastifyInstance } from 'fastify';
import { oauthRoute } from './oauth.route.js';
import { oauthCallbackRoutes } from './callback.route.js';
import { oauthUnlinkRoute } from './unlink.route.js';

export function oauthRoutes(fastify: FastifyInstance) {
	oauthRoute(fastify);
	oauthCallbackRoutes(fastify);
	oauthUnlinkRoute(fastify);
}
