/**
 * @file index.ts
 * @description index to export all user data related routes
 */

import { FastifyInstance } from 'fastify';
import { userDataImgsRoute } from './imgs.js';

export function userDataRoutes(fastify: FastifyInstance) {
	userDataImgsRoute(fastify);
}
