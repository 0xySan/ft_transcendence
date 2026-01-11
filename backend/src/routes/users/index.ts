/**
 * @file index.ts
 * @description index to export all user related routes
 */

import { FastifyInstance } from 'fastify';
import { userDataRoutes } from './data/index.js'
import { userAccountRoutes } from './accounts/index.js';
import { userProfileRoutes } from './profile.route.js';
import { userTwoFaRoutes } from './twoFa/index.js';
import { userMeRoutes } from './me.route.js';
import { userUsernameRoutes } from './username.route.js';

export function userRoutes(fastify: FastifyInstance) {
	userDataRoutes(fastify);
	userAccountRoutes(fastify);
	userProfileRoutes(fastify);
	userTwoFaRoutes(fastify);
	userMeRoutes(fastify);
	userUsernameRoutes(fastify);
}
