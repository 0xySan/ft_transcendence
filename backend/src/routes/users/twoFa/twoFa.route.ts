/**
 * @file routes/users/twoFa.route.ts
 * @description Routes for handling Two-Factor Authentication (2FA) creation & listing.
 */

import { FastifyInstance } from 'fastify';
import { getTwoFaMethodsSchema } from '../../../plugins/swagger/schemas/twoFa.schema.js';

import { v7 as uuidv7 } from 'uuid';

import { requireAuth } from '../../../middleware/auth.middleware.js';
import {
	create2FaMethods,
	getAllMethodsByUserIdByType,
	getUser2FaMethodsByUserId,
} from '../../../db/wrappers/auth/2fa/user2FaMethods.js';
import {
	createUser2faEmailOtp,
	getUser2faEmailOtpsByMethodIds,
} from '../../../db/wrappers/auth/2fa/user2faEmailOtp.js';
import { encryptSecret, generateRandomToken, hashString } from '../../../utils/crypto.js';
import { createTotpUri, generateTotpSecret } from '../../../auth/2Fa/totpUtils.js';
import { createUser2faTotp, createUser2faBackupCodes, getUserById, User, getProfileByUserId, session } from '../../../db/index.js';
import { generateQrCode } from '../../../auth/2Fa/qrCode/qrCode.js';
import { randomBytes } from 'crypto';
import { sendMail } from '../../../utils/mail/mail.js';

type MethodType = 0 | 1 | 2;

interface TwoFaMethodInput {
	methodType: MethodType;
	label?: string;
	params?: Record<string, any>;
}

interface TwoFaCreation {
	methods: TwoFaMethodInput[];
}

/* ---------- Constants ---------- */
const MAX_METHODS_PER_TYPE = 10;
const DEFAULT_TOTP_DURATION = 30;
const ALLOWED_TOTP_ALGOS = ['sha1', 'sha256', 'sha512'] as const;
type TotpAlgo = typeof ALLOWED_TOTP_ALGOS[number];
const ALLOWED_TOTP_DIGITS = [6, 8];

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
function normalizeTotpParams(params?: Record<string, any>) {
	const duration =
		typeof params?.duration === 'number' && params.duration >= 15 && params.duration <= 60
			? params.duration
			: DEFAULT_TOTP_DURATION;

	const algorithm =
		typeof params?.algorithm === 'string' && ALLOWED_TOTP_ALGOS.includes(params.algorithm as TotpAlgo)
			? (params.algorithm as TotpAlgo)
			: 'sha1';

	const digits =
		typeof params?.digits === 'number' && ALLOWED_TOTP_DIGITS.includes(params.digits)
			? params.digits
			: 6;

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
function generateBackupCodes(count = 10, len = 8): string[] {
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
	if (!params || typeof params.email !== 'string') {
		return { success: false, message: 'Missing or invalid email parameter.' };
	}

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
			USER_NAME: userProfile ? userProfile.username : params.mail.split('@')[0],
			VERIFICATION_CODE: code,
			RESET_PASSWORD_URL: `${process.env.MAIL_DOMAIN || 'https://pong.moutig.sh'}/reset-password`,
			CLIENT_INFO: `${session.ip || 'Unknown IP'}`,
		},
		`verify@${process.env.MAIL_DOMAIN || 'example.com'}`
	);

	createUser2faEmailOtp({
		method_id: methodId,
		email: params.email,
		last_sent_code_hash: codeHash,
		// last_sent_at, expires_at handled by DB default if needed
	});

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

	createUser2faTotp({
		method_id: methodId,
		secret_encrypted: secretStored,
		secret_meta: JSON.stringify({ duration, algorithm, digits }),
	});

	const otpauthUrl = createTotpUri(userEmail, secretBase32, 'Transcendence', algorithm, digits, duration);
	const qrMatrix = generateQrCode(otpauthUrl);

	return {
		success: true,
		message: 'TOTP method created successfully.',
		params: { otpauthUrl, qrMatrix }
	};
}

/**
 * Create Backup Codes 2FA Method
 * @param methodId The method UUID
 * @returns Result object with success status, message, and generated codes
 */
async function createBackupMethod(methodId: string) {
	const codes = generateBackupCodes(10, 8);

	const hashedCodes = await Promise.all(
		codes.map(async (code) => ({
			hash: await hashString(code),
			used: false
		}))
	);

	createUser2faBackupCodes({
		method_id: methodId,
		code_json: JSON.stringify(hashedCodes)
	});

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
		{ preHandler: requireAuth, schema: getTwoFaMethodsSchema, validatorCompiler: ({ schema }) => { return () => true; } },
		async (request, reply) => {
			const session = (request as any).session;
			const methods = getUser2FaMethodsByUserId(session.user_id)
				.filter(m => m.is_verified)
				.map(m => ({
					method_type: m.method_type,
					label: m.label,
					is_primary: m.is_primary
				}));
			if (methods.length === 0) {
				return reply.status(404).send({ message: '2Fa is not set up for your account.' });
			}
			return reply.send({ twoFaMethods: methods });
		}
	);

	fastify.post(
		'/twofa/',
		{ preHandler: requireAuth },
		async (request, reply) => {
			const session = (request as any).session;
			const body = request.body as TwoFaCreation;
			const userId = session.user_id;
			const user = getUserById(userId);
			if (!user) {
				return reply.status(404).send({ message: 'User not found.' });
			}

			if (!body?.methods?.length) {
				return reply.status(400).send({ message: 'No 2FA methods provided.' });
			}

			const results: any[] = [];

			for (const method of body.methods) {
				// validation
				const validationErr = validateMethodInput(method);
				if (validationErr) {
					results.push({
						methodType: method.methodType,
						label: method.label,
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
					create2FaMethods({
						method_id: methodId,
						user_id: userId,
						method_type: method.methodType,
						label: method.label,
						is_verified: false,
					});
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
						const res = await createEmailMethod(userId, methodId, session, method.params || {});
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
}
