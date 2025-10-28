/**
 * @file index.ts
 * @description index to export all user data related routes
 */

import { FastifyInstance } from 'fastify';
import { userDataImgsRoute } from './imgs.route.js';

export function userDataRoutes(fastify: FastifyInstance) {
	userDataImgsRoute(fastify);
}
