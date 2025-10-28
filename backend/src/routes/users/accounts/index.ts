/**
 * @file index.ts
 * @description index to export all user account related routes
 */

import { FastifyInstance } from 'fastify';
import { newUserAccountRoutes } from './register.js';
import { verifyUserAccountRoutes } from './verify.js';

export function userAccountRoutes(fastify: FastifyInstance) {
	newUserAccountRoutes(fastify);
	verifyUserAccountRoutes(fastify);
}
