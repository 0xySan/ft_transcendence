/**
 * src/routes/verify.route.ts
 * Verify user account route — Argon2 hash verification + rate limiting + timing defense
 */

import { FastifyInstance } from "fastify";
import { verifySchema } from "../../../plugins/swagger/schemas/verify.schema.js";
import {
	getEmailVerificationsByUserId,
	markEmailAsVerified
} from "../../../db/wrappers/auth/index.js";
import { getRoleByName, updateUserRole } from "../../../db/wrappers/main/index.js";
import { verifyHashedString, isValidUUIDv7 } from "../../../utils/crypto.js";
import { checkRateLimit, delayResponse } from "../../../utils/security.js";

// Simple in-memory rate limiter (per IP)
const requestCount: Record<string, { count: number; lastReset: number }> = {};
const RATE_LIMIT = 10; // max 10 requests per 15 minutes
const RATE_WINDOW = 15 * 60 * 1000;
const MIN_DELAY = 500; // ms, minimum response time to prevent timing attacks

export async function verifyUserAccountRoutes(fastify: FastifyInstance) {
	fastify.post(
		"/accounts/verify",
		{ schema: verifySchema, validatorCompiler: ({ schema }) => () => true },
		async (request, reply) => {
			const startTime = Date.now();
			const clientIp = request.ip || request.headers["x-forwarded-for"]?.toString() || "unknown";

			if (!checkRateLimit(requestCount, clientIp, reply, RATE_LIMIT, RATE_WINDOW)) {
				return; // rate limit exceeded, response already sent
			}

			const { user: rawUser, token: rawToken } = request.body as { user?: string; token?: string };

			if (!rawToken || !rawUser) {
				return reply.status(400).send("Missing token or user id");
			}

			const userId = decodeURIComponent(rawUser);
			if (!isValidUUIDv7(userId)) {
				return reply.status(400).send("Invalid user id");
			}

			const decodedToken = decodeURIComponent(rawToken);

			// fetch all verification records for this user
			const records = getEmailVerificationsByUserId(userId);
			if (!records || records.length === 0) {
				await delayResponse(startTime, MIN_DELAY);
				return reply.status(202).send({ message: "If the verification is valid, your email will be verified shortly." });
			}

			let matchedRecord: any = null;

			for (const rec of records) {
				if (!rec.token) continue;

				try {
					const isValid = await verifyHashedString(decodedToken, rec.token);
					if (isValid) {
						matchedRecord = rec;
						break;
					}
				} catch {
					continue;
				}
			}

			if (!matchedRecord) {
				await delayResponse(startTime, MIN_DELAY);
				return reply.status(202).send({ message: "If the verification is valid, your email will be verified shortly." });
			}

			// check expiration
			if (matchedRecord.expires_at && Number(matchedRecord.expires_at) < Date.now()) {
				await delayResponse(startTime, MIN_DELAY);
				return reply.status(202).send({ message: "If the verification is valid, your email will be verified shortly." });
			}

			// mark as verified
			try {
				markEmailAsVerified(matchedRecord.token);
			} catch (err) {
				fastify.log.error(`Failed to mark email as verified for user ${userId}: ${err}`);
				await delayResponse(startTime, MIN_DELAY);
				return reply.status(500).send("Failed to verify email");
			}

			// update user role to "user"
			try {
				updateUserRole(matchedRecord.user_id, getRoleByName("user")!.role_id);
			} catch (err) {
				fastify.log.error("Failed to update user role after verification");
			}

			await delayResponse(startTime, MIN_DELAY);
			return reply.status(202).send({ message: "If the verification is valid, your email will be verified shortly." });
		}
	);
}
