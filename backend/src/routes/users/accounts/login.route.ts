/**
 * @file login.route.ts
 * @description Secure user login route (OWASP-compliant, prevents user enumeration).
 */

import { FastifyInstance } from "fastify";
import { loginAccountSchema } from "../../../plugins/swagger/schemas/login.schema.js";
import { checkRateLimit, delayResponse } from "../../../utils/security.js";
import { getPasswordHashByUserId, getProfileByUsername, getUser2FaMethodsByUserId, getUserByEmail } from "../../../db/index.js";
import { verifyHashedString } from "../../../utils/crypto.js";
import { createNewSession } from "../../../utils/session.js";

const requestCount: Record<string, { count: number; lastReset: number }> = {};
const RATE_LIMIT = 5; // max 5 registrations per 15 minutes per IP or per email/username
const RATE_WINDOW = 15 * 60 * 1000;
const MIN_DELAY = 500; // ms, minimum response time to prevent timing attacks

export async function newUserLoginRoutes(fastify: FastifyInstance) {
	const passwordRegex = /^.{8,64}$/;

	fastify.post("/accounts/login", { schema: loginAccountSchema }, async (request, reply) => {
		const startTime = Date.now();
		const clientIp = request.ip || request.headers['x-forwarded-for']?.toString() || 'unknown';
		
		if (!checkRateLimit(requestCount, clientIp, reply, RATE_LIMIT, RATE_WINDOW)) {
			return;
		}

		try {
			const { username, email, password, rememberMe } = request.body as {
				username?: string;
				email?: string;
				password: string;
				rememberMe: boolean;
			};

			if (email && username) {
				return reply.status(400).send({ message: "Provide either email or username, not both." });
			}

			if (!password || !passwordRegex.test(password)) {
				await delayResponse(startTime, MIN_DELAY);
				return reply.status(400).send({message: "Login failed. Please try again later."});
			}

			let existingUser;
			if (email) {
				existingUser = getUserByEmail(email);
			} else if (username) {
				existingUser = getProfileByUsername(username);
			}

			if (!existingUser) {
				await delayResponse(startTime, MIN_DELAY);
				return reply.status(400).send({message: "Login failed. Please try again later."});
			}

			if (!checkRateLimit(requestCount, existingUser.user_id, reply, RATE_LIMIT, RATE_WINDOW)) {
				return;
			}

			const passwordHash = getPasswordHashByUserId(existingUser.user_id);
			if (!passwordHash) {
				await delayResponse(startTime, MIN_DELAY);
				return reply.status(400).send({ message: "Login failed. Please try again later." });
			}

			const isMatch = await verifyHashedString(password, passwordHash);
			
			if (!isMatch) {
				await delayResponse(startTime, MIN_DELAY);
				return reply.status(400).send({ message: "Login failed. Please try again later." });
			}

			const user2FaMethods = getUser2FaMethodsByUserId(existingUser.user_id)
				.filter(method => method.is_verified) // Only include verified methods
				.map(method => ({
					method_type: method.method_type,
					label: method.label,
					is_primary: method.is_primary
				}));
			
			if (user2FaMethods && user2FaMethods.length > 0) {
				const session = createNewSession(existingUser.user_id, {
					ip: request.ip,
					userAgent: request.headers['user-agent'],
					ttlMs: 10 * 60 * 1000, // 10 minutes
					stage: 'partial'
				});

				if (!session) {
					await delayResponse(startTime, MIN_DELAY);
					return reply.status(500).send({ message: "Login failed. Please try again later." });
				}

				reply.setCookie('session', session.token, {
					path: '/',
					httpOnly: true,
					secure: process.env.NODE_ENV !== 'test',
					sameSite: 'strict',
					maxAge: 10 * 60 // 10 minutes
				});

				return reply.status(202).send({
					message: "2FA required.",
					twoFactorRequired: true,
					twoFactorMethods: user2FaMethods
				});
			}

			else {
				const session = createNewSession(existingUser.user_id, {
					ip: request.ip,
					userAgent: request.headers['user-agent'],
					stage: 'active',
					isPersistent: rememberMe || false
				});

				if (!session) {
					await delayResponse(startTime, MIN_DELAY);
					return reply.status(500).send({ message: "Login failed. Please try again later." });
				}

				const maxAge = rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 2; // 30 days or 2 hours
				reply.setCookie('session', session.token, {
					path: '/',
					httpOnly: true,
					secure: process.env.NODE_ENV !== 'test',
					sameSite: 'strict',
					maxAge: maxAge
				});
				
				return reply.status(202).send({ 
					message: "Login successful.",
					user: { id: existingUser.user_id }
				});
			}
			
		} catch (error) {
			console.error("Error in /accounts/login:", error);
			await delayResponse(startTime, MIN_DELAY);
			return reply.status(500).send({ message: "Login failed. Please try again later." });
		}
	});
}