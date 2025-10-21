// src/routes/oauth/index.ts
import { FastifyInstance } from 'fastify';
import { googleRoutes } from './google.js';

export function oauthRoutes(fastify: FastifyInstance) {
  googleRoutes(fastify);
}
