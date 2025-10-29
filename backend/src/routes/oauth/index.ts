// src/routes/oauth/index.ts
import { FastifyInstance } from 'fastify';
import { oauthRoute } from './oauth.route.js';
import { googleRoutes } from './google.route.js';
import { ftRoutes } from './forty-two.route.js';
import { discordRoutes } from './discord.route.js';
import { githubRoutes } from './github.route.js';

export function oauthRoutes(fastify: FastifyInstance) {
  oauthRoute(fastify);
  googleRoutes(fastify);
  ftRoutes(fastify);
  discordRoutes(fastify);
  githubRoutes(fastify);
}
