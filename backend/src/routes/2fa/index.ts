/**
 * @file index.ts
 * @description index to export all 2fa related routes
 */

import { FastifyInstance } from 'fastify';
import { new2faRoutes } from './generate.route.js';

export async function twoFaRoutes(fastify: FastifyInstance) {
	fastify.register(new2faRoutes);
}