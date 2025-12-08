/**
 * @file login.route.ts
 * @description Secure user login route (OWASP-compliant, with 2FA support and partial session upgrade).
 */

import { FastifyInstance } from "fastify";
import { loginAccountSchema, loginPatchSchema } from "../../../plugins/swagger/schemas/login.schema.js";
import { checkRateLimit, delayResponse } from "../../../utils/security.js";
import {
	getPasswordHashByUserId,
	getProfileByUsername,
	getUser2FaMethodsByUserId,
	getUserByEmail,
	updateSession
} from "../../../db/index.js";
import { verifyHashedString, verifyToken } from "../../../utils/crypto.js";
import { createNewSession } from "../../../utils/session.js";
import { requirePartialAuth } from "../../../middleware/auth.middleware.js";

// ---------- Rate limiting ----------
const requestCount: Record<string, { count: number; lastReset: number }> = {};
const RATE_LIMIT = 5; // max 5 tentatives
const RATE_WINDOW = 15 * 60 * 1000; // 15 minutes
const MIN_DELAY = 500;

async function handleUserLoginValidation(
	request: any,
	reply: any,
	startTime: number,
	clientIp: string
) {
	const passwordRegex = /^.{8,64}$/;
	const { username, email, password, rememberMe } = request.body as {
		username?: string;
		email?: string;
		password: string;
		rememberMe: boolean;
	};

	if (!checkRateLimit(requestCount, clientIp, reply, RATE_LIMIT, RATE_WINDOW))
		return null;

	// --- Input validation ---
	if (email && username)
		return reply.status(400).send({ message: "Provide either email or username, not both." });

	if (!password || !passwordRegex.test(password)) {
		await delayResponse(startTime, MIN_DELAY);
		return reply.status(400).send({ message: "Login failed. Please try again later." });
	}

	let existingUser;
	if (email) existingUser = getUserByEmail(email);
	else if (username) existingUser = getProfileByUsername(username);

	if (!existingUser) {
		await delayResponse(startTime, MIN_DELAY);
		return reply.status(400).send({ message: "Login failed. Please try again later." });
	}

	if (!checkRateLimit(requestCount, existingUser.user_id, reply, RATE_LIMIT, RATE_WINDOW))
		return null;

	// --- Vérification du mot de passe ---
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

	return { existingUser, rememberMe };
}

// ---------- Routes ----------
export async function newUserLoginRoutes(fastify: FastifyInstance) {

	// --- [POST] /accounts/login ---
	fastify.post(
		"/accounts/login",
		{
			schema: loginAccountSchema,
			validatorCompiler: () => () => true
		}, async (request, reply) => {
		const startTime = Date.now();
		const clientIp = request.ip || request.headers["x-forwarded-for"]?.toString() || "unknown";

		try {
			const result = await handleUserLoginValidation(request, reply, startTime, clientIp);
			if (!result) return;

			const { existingUser, rememberMe } = result;

			const user2FaMethods = getUser2FaMethodsByUserId(existingUser.user_id)
				.filter(method => method.is_verified)
				.map(method => ({
					method_type: method.method_type,
					label: method.label,
					is_primary: method.is_primary
				}));

			// ---- 2FA required ----
			if (user2FaMethods && user2FaMethods.length > 0) {
				const session = createNewSession(existingUser.user_id, {
					ip: request.ip,
					userAgent: request.headers["user-agent"],
					ttlMs: 10 * 60 * 1000, // 10 min
					stage: "partial"
				});

				if (!session) {
					await delayResponse(startTime, MIN_DELAY);
					return reply.status(500).send({ message: "Login failed. Please try again later." });
				}

				reply.setCookie("session", session.token, {
					path: "/",
					httpOnly: true,
					secure: process.env.NODE_ENV !== "test",
					sameSite: "strict",
					maxAge: 10 * 60
				});

				return reply.status(202).send({
					message: "2FA required.",
					twoFactorRequired: true,
					twoFactorMethods: user2FaMethods
				});
			}

			// ---- Normal login ----
			const session = createNewSession(existingUser.user_id, {
				ip: request.ip,
				userAgent: request.headers["user-agent"],
				stage: "active",
				isPersistent: rememberMe || false
			});

			if (!session) {
				await delayResponse(startTime, MIN_DELAY);
				return reply.status(500).send({ message: "Login failed. Please try again later." });
			}

			const maxAge = rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 2; // 30j ou 2h
			reply.setCookie("session", session.token, {
				path: "/",
				httpOnly: true,
				secure: process.env.NODE_ENV !== "test",
				sameSite: "strict",
				maxAge
			});

			return reply.status(202).send({
				message: "Login successful.",
				user: { id: existingUser.user_id }
			});

		} catch (error) {
			console.error("Error in /accounts/login:", error);
			await delayResponse(Date.now(), MIN_DELAY);
			return reply.status(500).send({ message: "Login failed. Please try again later." });
		}
	});

	// --- [PATCH] /accounts/login ---
	fastify.patch(
		"/accounts/login",
		{
			preHandler: requirePartialAuth,
			schema: loginPatchSchema,
			validatorCompiler: () => () => true
		},
		async (request, reply) => {
		try {
			const { token } = request.body as { token?: string };
			const ipAddress = request.ip || request.headers["x-forwarded-for"]?.toString() || "unknown";
			const userId = (request as any).session?.user_id;

			if (!token)
				return reply.status(400).send({ message: "Missing 2FA token." });

			if (!checkRateLimit(requestCount, ipAddress, reply, RATE_LIMIT, RATE_WINDOW))
				return reply.status(429).send({ message: "Too many login attempts. Please try again later." });

			if (!userId)
				return reply.status(400).send({ message: "Invalid session." });

			if (!checkRateLimit(requestCount, userId, reply, RATE_LIMIT, RATE_WINDOW))
				return reply.status(429).send({ message: "Too many login attempts. Please try again later." });

			const decoded = verifyToken(token);
			if (!decoded)
				return reply.status(401).send({ message: "Invalid or expired token." });

			const session = (request as any).session;
			if (!session || session.stage !== "partial")
				return reply.status(400).send({ message: "No partial session to upgrade." });

			const upgraded = updateSession(session.session_id, { stage: "active" });

			if (!upgraded)
				return reply.status(500).send({ message: "Failed to upgrade session." });

			reply.setCookie("session", (request as any).token, {
				path: "/",
				httpOnly: true,
				secure: process.env.NODE_ENV !== "test",
				sameSite: "strict",
				maxAge: 60 * 60 * 2
			});

			return reply.status(200).send({
				message: "2FA verification successful. Session upgraded.",
				user: { id: session.user_id }
			});
		} catch (err) {
			console.error("Error in PATCH /accounts/login:", err);
			return reply.status(500).send({ message: "Unable to complete login process." });
		}
	});
}
