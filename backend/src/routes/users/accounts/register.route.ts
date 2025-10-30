/**
 * @file new.ts
 * @description Secure user registration route (OWASP-compliant, prevents user enumeration).
 */

import { FastifyInstance } from "fastify";
import { registerAccountSchema } from "../../../plugins/swagger/schemas/register.schema.js";
import geoip from 'geoip-lite';
import dotenv from 'dotenv';

import { 
	createUser, 
	getUserByEmail, 
	createProfile, 
	getProfileByUsername,
	getCountryByCode,
	getRoleByName
} from '../../../db/wrappers/main/index.js';

import { 
	getOauthAccountByProviderAndUserId,
	createEmailVerification,
	createOauthAccount
} from '../../../db/wrappers/auth/index.js';

import { hashString, generateRandomToken, encryptSecret } from '../../../utils/crypto.js';
import { saveAvatarFromUrl } from '../../../utils/userData.js';
import { sendMail } from "../../../utils/mail/mail.js";

dotenv.config({ quiet: true });

// Simple in-memory rate limiter (can be replaced with Redis later)
const requestCount: Record<string, { count: number; lastReset: number }> = {};
const RATE_LIMIT = 5; // max 5 registrations per 15 minutes per IP
const RATE_WINDOW = 15 * 60 * 1000;

export async function newUserAccountRoutes(fastify: FastifyInstance) {
	const emailRegex = /^[\p{L}\p{N}._%+-]{1,64}@[A-Za-z0-9.-]{1,255}\.[A-Za-z]{2,}$/u;
	const passwordRegex = /^.{8,64}$/;
	const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;

	fastify.post("/accounts/register", { schema: registerAccountSchema, validatorCompiler: ({ schema }) => {return () => true;} }, async (request, reply) => {
		const startTime = Date.now();
		const clientIp = request.ip || request.headers['x-forwarded-for']?.toString() || 'unknown';

		// --- Rate limiting ---
		const rate = requestCount[clientIp] || { count: 0, lastReset: startTime };
		if (startTime - rate.lastReset > RATE_WINDOW) {
			rate.count = 0;
			rate.lastReset = startTime;
		}
		rate.count++;
		requestCount[clientIp] = rate;

		if (rate.count > RATE_LIMIT) {
			await new Promise(res => setTimeout(res, 1000)); // uniform delay
			reply.header('Retry-After', Math.ceil(RATE_WINDOW / 1000));
			return reply.status(429).send({
				message: "Too many registration attempts. Please try again later."
			});
		}

		try {
			const { username, email, password, oauth, pfp, display_name } = request.body as {
				username?: string;
				email?: string;
				password?: string;
				oauth?: {
					provider_name: string;
					provider_user_id: string;
					profile_json?: string;
					id_token_hash?: string;
				};
				pfp?: string;
				display_name?: string;
			};

			// --- Basic validation (no enumeration risk) ---
			if (!email || !emailRegex.test(email) || !username || !usernameRegex.test(username)) {
				await delayResponse(startTime);
				return reply.status(400).send({
					message: "Invalid registration details. Please check your input."
				});
			}

			if (!password && !oauth) {
				await delayResponse(startTime);
				return reply.status(400).send({ message: "Missing authentication information." });
			}

			if (password && !passwordRegex.test(password)) {
				await delayResponse(startTime);
				return reply.status(400).send({
					message: "Invalid password format."
				});
			}

			// --- Silent existence checks (no error exposure) protect against user enumeration ---
			const existingUser = getUserByEmail(email);
			const existingProfile = getProfileByUsername(username);
			const existingOauth = oauth
				? getOauthAccountByProviderAndUserId(oauth.provider_name, oauth.provider_user_id)
				: null;

			if (existingUser || existingProfile || existingOauth) {
				console.warn(`Duplicate registration attempt for ${email || username}`);
				await delayResponse(startTime);
				return reply.status(202).send({
					message: "If the registration is valid, a verification email will be sent shortly."
				});
			}

			// --- Proceed with creation ---
			let passwordHash = "";
			if (password) {
				passwordHash = await hashString(password);
			}

			const newUser = createUser(email!, passwordHash, getRoleByName('unverified')!.role_id);
			if (!newUser) {
				await delayResponse(startTime);
				return reply.status(500).send({ message: "Registration failed. Please try again later." });
			}

			let countryId: number | undefined;
			const geo = geoip.lookup(clientIp);
			if (geo && geo.country) {
				const country = getCountryByCode(geo.country);
				if (country) countryId = country.country_id;
			}

			let avatarFileName: string | undefined;
			if (pfp) {
				try {
					avatarFileName = await saveAvatarFromUrl(newUser.user_id.toString(), pfp);
				} catch (err) {
					console.error("Failed to save avatar:", err);
				}
			}

			createProfile(
				newUser.user_id,
				username!,
				display_name || username!,
				avatarFileName,
				countryId
			);

			if (oauth) {
				createOauthAccount({
					user_id: newUser.user_id,
					provider_name: oauth.provider_name,
					provider_user_id: oauth.provider_user_id,
					profile_json: oauth.profile_json,
					id_token_hash: oauth.id_token_hash,
					linked_at: Date.now(),
				});
			}

			const verificationToken = generateRandomToken(32);
			const encryptedToken = encryptSecret(verificationToken).toString('base64');
			createEmailVerification({
				user_id: newUser.user_id,
				token: encryptedToken,
				expires_at: Date.now() + 60 * 60 * 1000,
			});

			sendMail(
				newUser.email,
				"Welcome to ft_transcendence!",
				"accountVerification.html",
				{
					HEADER: "Welcome to ft_transcendence!",
					VERIFICATION_LINK: `https://moutig.sh/verify?user=${newUser.user_id}&token=${encodeURIComponent(verificationToken)}`,
				},
				`verify@${process.env.MAIL_DOMAIN || 'example.com'}`
			).catch(err => console.error("Failed to send email:", err));

			await delayResponse(startTime);
			return reply.status(202).send({
				message: "If the registration is valid, a verification email will be sent shortly."
			});
		} catch (err) {
			console.error("Error in /accounts/register:", err);
			await delayResponse(startTime);
			return reply.status(500).send({ message: "Registration failed. Please try again later." });
		}
	});
}

async function delayResponse(startTime: number) {
	const elapsed = Date.now() - startTime;
	const minDelay = 500; // in ms — ensures uniform timing
	if (elapsed < minDelay) {
		await new Promise(res => setTimeout(res, minDelay - elapsed));
	}
}