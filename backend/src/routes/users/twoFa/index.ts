/**
 * @file twoFa/index.ts
 * @description Entry point for Two-Factor Authentication (2FA) routes.
 */

import { FastifyInstance } from 'fastify';
import twoFaRoutes from './twoFa.route.js';
import emailSendRoutes from './emailSend.route.js';

export function userTwoFaRoutes(fastify: FastifyInstance) {
	twoFaRoutes(fastify);
	emailSendRoutes(fastify);
}