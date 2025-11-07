/**
 * @file twoFa/index.ts
 * @description Entry point for Two-Factor Authentication (2FA) routes.
 */

import { FastifyInstance } from 'fastify';
import twoFaRoutes from './twoFa.route.js';

export function userTwoFaRoutes(fastify: FastifyInstance) {
	twoFaRoutes(fastify);
}