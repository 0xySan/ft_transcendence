/**
 * @file index.ts
 * @description index to export all user related routes
 */

import { FastifyInstance } from 'fastify';
import { userDataRoutes } from './data/index.js'

export function userRoutes(fastify: FastifyInstance) {
	userDataRoutes(fastify);
}
