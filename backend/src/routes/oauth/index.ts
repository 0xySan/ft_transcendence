// src/routes/oauth/index.ts
import { FastifyInstance } from 'fastify';
import { googleRoutes } from './google.js';
import { routes } from './forty-two.js';

export function oauthRoutes(fastify: FastifyInstance) {
  googleRoutes(fastify);
  routes(fastify);
}
