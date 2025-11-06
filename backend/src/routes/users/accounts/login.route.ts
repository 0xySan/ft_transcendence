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
				rememberMe?: boolean;
			};

			if (email && username) {
				return reply.status(400).send({ message: "Provide either email or username, not both." });
			}

			if (!password || !passwordRegex.test(password)) {
				await delayResponse(startTime, MIN_DELAY);
				return reply.status(400).send({
					message: "Login failed. Please try again later."
				});
			}

			// Await database calls
			let existingUser;
			if (email) {
				existingUser = getUserByEmail(email);
			} else if (username) {
				existingUser = getProfileByUsername(username);
			}

			if (!existingUser) {
				await delayResponse(startTime, MIN_DELAY);
				return reply.status(400).send({
					message: "Login failed. Please try again later."
				});
			}

			if (!checkRateLimit(requestCount, existingUser.user_id, reply, RATE_LIMIT, RATE_WINDOW)) {
				return;
			}

			// Await password hash retrieval
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

			// Await 2FA methods check
			const user2FaMethods = getUser2FaMethodsByUserId(existingUser.user_id);
			
			if (user2FaMethods && user2FaMethods.length > 0) {
				const maxAge = 60 * 15; // 15 minutes for 2FA verification
				reply.setCookie('2fa', JSON.stringify(user2FaMethods), { // example: setting 'totp' as the 2FA method
					path: '/',
					secure: process.env.NODE_ENV !== 'test',
					sameSite: 'strict',
					maxAge: maxAge
				});

				return reply.status(202).send({
					message: "Login requires 2FA verification.",
					requires2fa: true 
				});
			}

			else {
				const result = createNewSession(existingUser.user_id, {
					ip: request.ip,
					userAgent: request.headers['user-agent']
				});

				if (!result) {
					await delayResponse(startTime, MIN_DELAY);
					return reply.status(500).send({ message: "Login failed. Please try again later." });
				}

				const maxAge = rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 2; // 30 days or 2 hours
				reply.setCookie('session', result.token, {
					path: '/',
					httpOnly: true,
					secure: process.env.NODE_ENV !== 'test',
					sameSite: 'strict',
					maxAge: maxAge
				});
				
				return reply.status(200).send({ 
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