/**
 * @file index.ts
 * @description index to export all user account related routes
 */

import { FastifyInstance } from 'fastify';
import { newUserAccountRoutes } from './register.route.js';
import { verifyUserAccountRoutes } from './verify.route.js';
import { newPasswordReset } from './passwordReset.route.js';

export function userAccountRoutes(fastify: FastifyInstance) {
	newUserAccountRoutes(fastify);
	verifyUserAccountRoutes(fastify);
	newPasswordReset(fastify);
}
