// src/routes/oauth/index.ts
import { FastifyInstance } from 'fastify';
import { googleRoutes } from './google.js';
import { ftRoutes } from './forty-two.js';
import { discordRoutes } from './discord.js';
import { githubRoutes } from './github.js';

export function oauthRoutes(fastify: FastifyInstance) {
  googleRoutes(fastify);
  ftRoutes(fastify);
  discordRoutes(fastify);
  githubRoutes(fastify);
}
