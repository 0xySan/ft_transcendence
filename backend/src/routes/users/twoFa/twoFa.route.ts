/**
 * @file routes/users/twoFa.route.ts
 * @description Routes for handling Two-Factor Authentication (2FA) creation & listing.
 */

import { FastifyInstance } from 'fastify';
import { createTwoFaMethodsSchema, getTwoFaMethodsSchema, patchTwoFaSchema } from '../../../plugins/swagger/schemas/twoFa.schema.js';

import { v7 as uuidv7 } from 'uuid';

import { requireAuth, requirePartialAuth } from '../../../middleware/auth.middleware.js';
import {
	create2FaMethods,
	getAllMethodsByUserIdByType,
	getUser2FaMethodsByUserId,
	updateBatch2FaMethods,
} from '../../../db/wrappers/auth/2fa/user2FaMethods.js';
import type { user2FaMethods } from '../../../db/wrappers/auth/2fa/user2FaMethods.js';

import {
	createUser2faEmailOtp,
	getUser2faEmailOtpsByMethodIds,
} from '../../../db/wrappers/auth/2fa/user2faEmailOtp.js';
import { encryptSecret, generateRandomToken, hashString, verifyToken } from '../../../utils/crypto.js';
import { createTotpUri, generateTotpSecret } from '../../../auth/2Fa/totpUtils.js';
import { createUser2faTotp, createUser2faBackupCodes, getUserById, User, getProfileByUserId, session } from '../../../db/index.js';
import { generateQrCode } from '../../../auth/2Fa/qrCode/qrCode.js';
import { randomBytes } from 'crypto';
import { sendMail } from '../../../utils/mail/mail.js';
import { checkRateLimit } from '../../../utils/security.js';

type MethodType = 0 | 1 | 2;

interface	TwoFaMethodInput {
	methodType:	MethodType;
	label?:		string;
	params?:	Record<string, any>;
}

interface	TwoFaCreation {
	methods:		TwoFaMethodInput[];
	twoFaToken?:	string;
}

interface TwofaPatchBody {
	token: string;
	changes: Record<string, {
		disable?:		boolean;
		label?:			string;
		is_primary?:	boolean;
	}>;
}

/* ---------- Constants ---------- */
const MAX_METHODS_PER_TYPE = 10;
export const DEFAULT_TOTP_DURATION = 30;
export const ALLOWED_TOTP_ALGOS = ['sha1', 'sha256', 'sha512'] as const;
type TotpAlgo = typeof ALLOWED_TOTP_ALGOS[number];
export const ALLOWED_TOTP_DIGITS = [6, 8];

/* ---------- Rate Limiting ---------- */
const ipRequestCount: Record<string, { count: number; lastReset: number }> = {};
const userRequestCount: Record<string, { count: number; lastReset: number }> = {};
const RATE_LIMIT = 25;
const IP_RATE_WINDOW = 60_000;
const USER_RATE_WINDOW = 300_000;

/* ---------- Helpers ---------- */

/**
 * Validate label string
 * @param label The label to validate
 * @returns True if valid, false otherwise
 */
function isValidLabel(label?: unknown): label is string {
	return typeof label === 'string' && label.length >= 3 && label.length <= 100;
}

/**
 * Normalize TOTP parameters with defaults and validation
 * @param params The input parameters
 * @returns Normalized parameters
 */
export function normalizeTotpParams(params?: Record<string, any>) {
	const duration =
		typeof params?.duration === 'number' && params.duration >= 15 && params.duration <= 60
			? params.duration: DEFAULT_TOTP_DURATION;

	const algorithm =
		typeof params?.algorithm === 'string' && ALLOWED_TOTP_ALGOS.includes(params.algorithm as TotpAlgo)
			? (params.algorithm as TotpAlgo): 'sha1';

	const digits =
		typeof params?.digits === 'number' && ALLOWED_TOTP_DIGITS.includes(params.digits)
			? params.digits: 6;

	return { duration, algorithm, digits };
}

/**
 * Generate a 6-digit numeric code as a string
 * @returns A 6-digit numeric code as a string
 */
function generateNumericCode(): string {
	// 4 bytes -> 32 bits -> modulo 1_000_000
	const buf = Buffer.from(generateRandomToken(4), 'hex');
	const n = buf.readUInt32BE(0) % 1_000_000;
	return n.toString().padStart(6, '0');
}

/**
 * Generate backup codes
 * @param count Number of codes to generate
 * @param len Length of each code
 * @returns Array of backup codes
 */
export function generateBackupCodes(count = 10, len = 8): string[] {
	const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O, I/1
	const codes: string[] = [];
	for (let i = 0; i < count; i++) {
		let code = '';
		const bytes = randomBytes(len);
		for (let j = 0; j < len; j++) {
			const idx = bytes[j] % charset.length;
			code += charset[idx];
		}
		codes.push(code);
	}
	return codes;
}

/* ---------- Method creation helpers ---------- */
/**
 * Create Email OTP 2FA Method
 * @param user The user object
 * @param methodId The method UUID
 * @param session The user session
 * @param params Additional parameters (email)
 * @returns Result object with success status and message
 */
async function createEmailMethod(user: User, methodId: string, session: session, params: Record<string, any>) {
	if (!params || typeof params.email !== 'string' || !params.email.includes('@'))
		return { success: false, message: 'Missing or invalid email parameter.' };


	// code generation + store hash
	const code = generateNumericCode();
	const codeHash = await hashString(code);

	const userProfile = getProfileByUserId(user.user_id);

	sendMail(
		params.email,
		'Your ft_transcendence account: Address 2FA Verification',
		'2faVerification.html',
		{
			HEADER: 'Address 2FA Verification',
			USER_NAME: userProfile ? userProfile.username : params.email.split('@')[0],
			VERIFICATION_CODE: code,
			RESET_PASSWORD_URL: `${process.env.MAIL_DOMAIN || 'https://pong.moutig.sh'}/reset-password`,
			CLIENT_INFO: `${session.ip || 'Unknown IP'}`,
		},
		`verify@${process.env.MAIL_DOMAIN || 'example.com'}`
	);

	const result = createUser2faEmailOtp({
		method_id: methodId,
		email: params.email,
		last_sent_code_hash: codeHash,
	});
	if (!result)
		return { success: false, message: 'Failed to create Email OTP method in database.' };

	return { success: true, message: 'Email OTP method created successfully.' };
}

/**
 * Create TOTP 2FA Method
 * @param userEmail The user's email
 * @param methodId The method UUID
 * @param label The method label
 * @param params Additional parameters (duration, algorithm, digits)
 * @returns Result object with success status, message, and TOTP setup info
 */
async function createTotpMethod(userEmail: string, methodId: string, label: string | undefined, params: Record<string, any>) {
	const { duration, algorithm, digits } = normalizeTotpParams(params);

	const secretBase32 = generateTotpSecret(algorithm);
	const encrypted = encryptSecret(secretBase32);

	const secretStored = typeof encrypted === 'string' ? encrypted : encrypted.toString('hex');

	const result = createUser2faTotp({
		method_id: methodId,
		secret_encrypted: secretStored,
		secret_meta: JSON.stringify({ duration, algorithm, digits }),
	});
	if (!result)
		return { success: false, message: 'Failed to create TOTP method in database.' };

	const otpAuthUrl = createTotpUri(userEmail, secretBase32, 'Transcendence', algorithm, digits, duration);
	const qrMatrix = generateQrCode(otpAuthUrl);

	return {
		success: true,
		message: 'TOTP method created successfully.',
		params: { otpAuthUrl, qrMatrix }
	};
}

/**
 * Create Backup Codes 2FA Method
 * @param methodId The method UUID
 * @returns Result object with success status, message, and generated codes
 */
async function createBackupMethod(methodId: string) {
	const codes = generateBackupCodes(10, 6);

	const hashedCodes = codes.map((code) => ({
			hash: encryptSecret(code).toString('base64'),
			used: false
		}))

	const result = createUser2faBackupCodes({
		method_id: methodId,
		code_json: JSON.stringify(hashedCodes)
	});
	if (!result)
		return { success: false, message: 'Failed to create Backup Codes method in database.' };

	return {
		success: true,
		message: 'Backup codes generated successfully.',
		params: { codes }
	};
}

/* ---------- Validation helpers ---------- */

/**
 * Validate TwoFaMethodInput
 * @param m The method input to validate
 * @returns Error message string if invalid, null if valid
 */
function validateMethodInput(m: TwoFaMethodInput) {
	if (!m || typeof m !== 'object') return 'Invalid method object.';
	if (![0, 1, 2].includes(m.methodType)) return 'Invalid methodType.';
	if (m.label !== undefined && !isValidLabel(m.label)) return 'Invalid label.';
	return null;
}

/* ---------- Route export ---------- */
export default async function twoFaRoutes(fastify: FastifyInstance) {
	fastify.get(
		'/twofa/',
		{	preHandler: requirePartialAuth,
			schema: getTwoFaMethodsSchema,
			validatorCompiler: ({ schema }) => { return () => true; }},
		async (request, reply) => {
			const session = (request as any).session;
			const ip = (request.ip || 'unknown').toString();

			// --- Rate limit ---
			if (!checkRateLimit(ipRequestCount, ip, reply, RATE_LIMIT, IP_RATE_WINDOW))
				return reply.status(429).send({ message: 'Too many requests. Try again later.' });
			
			if (!checkRateLimit(userRequestCount, session.user_id, reply, RATE_LIMIT, USER_RATE_WINDOW))
				return reply.status(429).send({ message: 'Too many requests. Try again later.' });

			const methods = getUser2FaMethodsByUserId(session.user_id)
				.map(m => ({
					id: m.method_id,
					method_type: m.method_type,
					label: m.label,
					is_primary: m.is_primary,
					is_verified: m.is_verified,
					created_at: m.created_at
				}));
			if (methods.length === 0) {
				return reply.status(404).send({ message: '2Fa is not set up for your account.' });
			}
			return reply.send({ twoFaMethods: methods });
		}
	);

	fastify.post(
		'/twofa/',
		{	preHandler: requireAuth,
			schema: createTwoFaMethodsSchema,
			validatorCompiler: ({ schema }) => { return () => true; }},
		async (request, reply) => {
			const session = (request as any).session;
			const body = request.body as TwoFaCreation;
			const userId = session.user_id;
			const user = getUserById(userId);
			const ip = (request.ip || 'unknown').toString();

			// --- Rate limit ---
			if (!checkRateLimit(ipRequestCount, ip, reply, RATE_LIMIT, IP_RATE_WINDOW))
				return reply.status(429).send({ message: 'Too many requests. Try again later.' });
			
			if (!checkRateLimit(userRequestCount, userId, reply, RATE_LIMIT, USER_RATE_WINDOW))
				return reply.status(429).send({ message: 'Too many requests. Try again later.' });

			// --- Basic validation ---
			if (!user)
				return reply.status(404).send({ message: 'User not found.' });

			if (!body?.methods?.length)
				return reply.status(400).send({ message: 'No 2FA methods provided.' });

			const methods = getUser2FaMethodsByUserId(session.user_id)
				.map(m => ({
					id: m.method_id,
					method_type: m.method_type,
					label: m.label,
					is_primary: m.is_primary,
					is_verified: m.is_verified,
					created_at: m.created_at
				}));
			for (const m of methods) {
				if (m.is_verified) {
					if (!body.twoFaToken)
						return reply.status(400).send({ message: '2FA token required to add more methods.' });
					else {
						const valid = verifyToken(body.twoFaToken);
						if (!valid)
							return reply.status(400).send({ message: 'Invalid or expired 2FA token.' });
						else
							break;
					}
				}
			}

			const results: any[] = [];

			for (const method of body.methods) {
				// validation
				const validationErr = validateMethodInput(method);
				if (validationErr) {
					results.push({
						methodType: undefined,
						label: undefined,
						success: false,
						message: validationErr
					});
					continue;
				}

				// create method id and check quota
				const methodId = uuidv7();
				const existingMethods = getAllMethodsByUserIdByType(userId, method.methodType);
				if (existingMethods.length >= MAX_METHODS_PER_TYPE) {
					results.push({
						methodType: method.methodType,
						label: method.label,
						success: false,
						message: 'Maximum number of this 2FA method type reached.'
					});
					continue;
				}

				// additional checks per type
				if (method.methodType === 0) {
					// check duplicate email among existing email-methods
					const existingMethodIds = existingMethods.map(m => m.method_id).filter(Boolean);
					if (existingMethodIds.length > 0) {
						const existingOtps = getUser2faEmailOtpsByMethodIds(existingMethodIds);
						if (existingOtps.some(o => o.email === method.params?.email)) {
							results.push({
								methodType: method.methodType,
								label: method.label,
								success: false,
								message: 'An Email OTP method with this email already exists.'
							});
							continue;
						}
					}
				}

				// persist base method row
				try {
					let isPrimary = false;
					if (methods.length === 0 && results.filter(r => r.success).length === 0)
						isPrimary = true;
					const dbMethod = create2FaMethods({
						method_id: methodId,
						user_id: userId,
						method_type: method.methodType,
						label: method.label,
						is_primary: isPrimary,
						is_verified: method.methodType === 2 ? true : false, // backup codes are already verified
					});
					if (!dbMethod) {
						results.push({
							methodType: method.methodType,
							label: method.label,
							success: false,
							message: 'Failed to create 2FA method in database.'
						});
						continue;
					}
				} catch (err: any) {
					results.push({
						methodType: method.methodType,
						label: method.label,
						success: false,
						message: 'Database error while creating method row: ' + (err?.message || String(err))
					});
					continue;
				}

				// create specific subtype
				try {
					if (method.methodType === 0) {
						const res = await createEmailMethod(user, methodId, session, method.params || {});
						results.push({ methodType: 0, label: method.label, methodId, ...res });
					} else if (method.methodType === 1) {
						const res = await createTotpMethod(user.email, methodId, method.label, method.params || {});
						results.push({ methodType: 1, label: method.label, methodId, ...res });
					} else /* methodType === 2 */ {
						const res = await createBackupMethod(methodId);
						results.push({ methodType: 2, label: method.label, methodId, ...res });
					}
				} catch (err: any) {
					results.push({
						methodType: method.methodType,
						label: method.label,
						methodId,
						success: false,
						message: 'Database error while creating subtype: ' + (err?.message || String(err))
					});
				}
			}
			return reply.status(201).send({ results });
		}
	);

	fastify.patch(
		"/twofa",
		{
			preHandler: requireAuth,
			schema: patchTwoFaSchema,
			validatorCompiler: ({ schema }) => { return () => true; }
		},
		async (req, reply) => {
			const userId = (req as any).session.user_id
			const body = req.body as TwofaPatchBody
			const ip = (req.ip || 'unknown').toString();

			// --- Rate limit ---
			if (!checkRateLimit(ipRequestCount, ip, reply, RATE_LIMIT, IP_RATE_WINDOW))
				return reply.status(429).send({ message: 'Too many requests. Try again later.' });
			
			if (!checkRateLimit(userRequestCount, userId, reply, RATE_LIMIT, USER_RATE_WINDOW))
				return reply.status(429).send({ message: 'Too many requests. Try again later.' });

			// Basic validation
			if (!body || typeof body !== "object")
				return reply.code(400).send({ error: "invalid request body" })

			if (typeof body.token !== "string")
				return reply.code(400).send({ error: "invalid request body" })

			if (!body.changes || typeof body.changes !== "object")
				return reply.code(400).send({ error: "No changes provided" })

			if (Object.keys(body.changes).length === 0)
				return reply.code(400).send({ error: "No changes provided" })

			if (!verifyToken(body.token))
				return reply.code(400).send({ error: "invalid request body" })

			// Load current methods
			const methods = getUser2FaMethodsByUserId(userId)
			const byId = new Map(methods.map(m => [m.method_id, m]))

			const results = []
			const updated: user2FaMethods[] = []

			// Apply changes
			for (const [methodId, update] of Object.entries(body.changes)) {
				const method = byId.get(methodId)

				if (!method) {
					results.push({ methodId, success: false, message: "Method not found" })
					continue
				}

				// label
				if (update.label !== undefined) {
					if (!isValidLabel(update.label)) {
						results.push({ methodId, success: false, message: "Invalid label" })
						continue
					}
					method.label = update.label
				}

				// disable
				if (update.disable === true)
					method.is_verified = false
				else if (update.disable === false) {
					results.push({ methodId, success: false, message: "Re-enabling 2FA methods is not allowed." })
					continue
				}

				// is_primary
				if (update.is_primary === true || update.is_primary === false)
					method.is_primary = update.is_primary === true

				results.push({ methodId, success: true })
				updated.push(method)
			}

			// Must have at least one active 2FA left
			if (![...byId.values()].some(m => m.is_verified))
				return reply.code(400).send({ error: "At least one verified 2FA method must remain active." })

			// Ensure only one primary
			const primaries = [...byId.values()].filter(m => m.is_primary)
			if (primaries.length === 0) {
				const firstVerified = [...byId.values()].find(m => m.is_verified)
				if (firstVerified)
					firstVerified.is_primary = true
			} else if (primaries.length > 1)
				return reply.code(400).send({ error: "Only one primary 2FA method can be set." })

			// Save DB changes
			if (updated.length > 0) {
				const ok = updateBatch2FaMethods(updated)
				if (!ok)
					return reply.code(500).send({ error: "Failed to update 2FA methods in database." })
			}

			return reply.code(200).send({results})
		}
	)

}
