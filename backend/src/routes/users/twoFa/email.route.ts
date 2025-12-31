/**
 * @file routes/users/twoFa/emailSend.route.ts
 * @description Routes for handling Two-Factor Authentication (2FA) email sending.
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { emailSendSchema, emailTokenSchema, emailValidateSchema } from '../../../plugins/swagger/schemas/twoFa.schema.js';

import { requirePartialAuth } from '../../../middleware/auth.middleware.js';
import { getUser2faEmailOtpByMethodId, getUser2FaMethodsByUserId, getUserById, updateUser2faEmailOtp, getProfileByUserId, getUser2FaMethodsById, update2FaMethods, user2faEmailOtp } from '../../../db/index.js';
import { generateRandomToken, hashString, signToken, verifyHashedString } from '../../../utils/crypto.js';

import { sendMail } from "../../../utils/mail/mail.js";
import { checkRateLimit } from '../../../utils/security.js';
import { generateBackupCodes } from './twoFa.route.js';

interface twoFaEmailBody {
	uuid: string;
	code: string;
}

const MAX_EMAIL_OTP_ATTEMPTS = 5;

const requestCount: Record<string, { count: number; lastReset: number }> = {};
const RATE_LIMIT = 10;
const RATE_WINDOW = 10 * 60 * 1000;

async function checkEmailOtpRequest(
	request: FastifyRequest,
	reply: FastifyReply
): Promise<user2faEmailOtp | undefined> {
	const session = (request as any).session;
			const userId = session?.user_id;
			const ip = session?.ip || request.ip || 'unknown';
			const body = request.body as twoFaEmailBody;

			// --- Rate limit ---
			if (!checkRateLimit(requestCount, ip, reply, RATE_LIMIT, RATE_WINDOW)
				|| !checkRateLimit(requestCount, userId, reply, RATE_LIMIT, RATE_WINDOW))
				return reply.status(429).send({ message: 'Rate limit exceeded. Please try again later.' }), undefined;

			// --- Input validation ---
			if (!body.uuid || !body.code)
				return reply.status(400).send({ message: 'UUID and code are required.' }), undefined;

			if (!/^[A-Z0-9]{6,8}$/.test(body.code))
				return reply.status(400).send({ message: 'Invalid code format.' }), undefined;

			// --- Retrieve method (anti-enumeration) ---
			const emailMethod = getUser2faEmailOtpByMethodId(body.uuid);
			if (!emailMethod)
				return reply.status(401).send({ message: 'Invalid code.' }), undefined;

			// --- Verify expiration ---
			if (!emailMethod.expires_at || emailMethod.expires_at < Date.now())
				return reply.status(401).send({ message: 'Invalid code.' }), undefined;

			// --- Verify attempts ---
			if ((emailMethod.attempts ?? 0) >= MAX_EMAIL_OTP_ATTEMPTS)
				return reply.status(401).send({ message: 'Invalid code.' }), undefined;

			// --- Verify code ---
			try {
				const correct = verifyHashedString(body.code, emailMethod.last_sent_code_hash!);
				if (!correct) {
					updateUser2faEmailOtp(emailMethod.email_otp_id, {
						attempts: (emailMethod.attempts ?? 0) + 1,
					});
					return reply.status(401).send({ message: 'Invalid code.' }), undefined;
				}
			} catch {
				return reply.status(500).send({ message: 'Failed to verify code.' }), undefined;
			}
	return emailMethod;
}

export default async function emailSendRoutes(fastify: FastifyInstance) {
	fastify.post(
		'/twofa/email/send',
		{
			preHandler: requirePartialAuth,
			schema: emailSendSchema,
			validatorCompiler: ({ schema }) => {
				return () => true;
			},
		},
		async (request, reply) => {
			const startTime = Date.now();
			const session = (request as any).session;
			const userId = session?.user_id;

			try {
				const methodUuid = (request.body as { uuid?: string; }).uuid;

				if (!checkRateLimit(requestCount, session.ip || 'unknown', reply, RATE_LIMIT, RATE_WINDOW))
					return reply.status(429).send({ message: 'Rate limit exceeded. Please try again later.' });

				if (!checkRateLimit(requestCount, userId, reply, RATE_LIMIT, RATE_WINDOW))
					return reply.status(429).send({ message: 'Rate limit exceeded. Please try again later.' });

				if (!methodUuid)
					return reply.status(400).send({ message: 'Method UUID is required.' });

				const userProfile = getProfileByUserId(session.user_id);
				if (!userProfile)
					return reply.status(400).send({ message: '2fa not found' });

				const emailMethod = getUser2faEmailOtpByMethodId(methodUuid);

				if (!emailMethod)
					return reply.status(400).send({ message: '2fa not found' });

				const otp_code = generateBackupCodes(1, 6)[0];
				const hashed_otp = await hashString(otp_code);

				const update = updateUser2faEmailOtp(emailMethod.email_otp_id, {
					last_sent_code_hash: hashed_otp,
					expires_at: startTime + 15 * 60 * 1000,
					last_sent_at: startTime,
					attempts: (emailMethod.attempts ?? 0) + 1,
					consumed: 0,
				});

				if (!update)
					return reply.status(500).send({ message: 'Failed to send 2FA email.' });

				sendMail(
					emailMethod.email,
					'Your ft_transcendence account: Access from new computer',
					'2faVerification.html',
					{
						HEADER: 'Access from new computer',
						USER_NAME: userProfile.username,
						VERIFICATION_CODE: otp_code,
						CLIENT_INFO: `${session.ip || 'Unknown IP'}`,
					},
					`verify@${process.env.MAIL_DOMAIN || 'example.com'}`
				);

				return reply.status(202).send({ message: '2FA email sent successfully.' });
			} catch (err) {
				console.error('Error in /twofa/email/send:', err);
				return reply.status(500).send({ message: 'Internal server error.' });
			}
		}
	);

	fastify.post(
		'/twofa/email/validate',
		{
			preHandler: requirePartialAuth,
			schema: emailValidateSchema,
			validatorCompiler: ({ schema }) => {
				return () => true;
			},
		},
		async (request, reply) => {
			const userId = (request as any).session?.user_id;
			const emailMethod = await checkEmailOtpRequest(request, reply);
			if (!emailMethod)
				return;

			const twoFaMethod = getUser2FaMethodsById(emailMethod.method_id);
			if (!twoFaMethod || twoFaMethod.user_id !== userId)
				return reply.status(401).send({ message: 'Invalid code.' });

			const verified = update2FaMethods(twoFaMethod.method_id, {
				is_verified: true,
			});

			if (!verified)
				return reply.status(500).send({ message: 'Failed to verify 2FA method.' });

			// --- Consume code ---
			const update = updateUser2faEmailOtp(emailMethod.email_otp_id, {
				consumed: 1,
				attempts: (emailMethod.attempts ?? 0) + 1,
			});

			if (!update)
				return reply.status(500).send({ message: 'Failed to verify 2FA method.' });

			return reply.status(200).send({ message: 'Email code validated successfully.' });
		}
	);

	fastify.post(
		'/twofa/email',
		{
			preHandler: requirePartialAuth,
			schema: emailTokenSchema,
			validatorCompiler: ({ schema }) => {
				return () => true;
			},
		},
		async (request, reply) => {
			const emailMethod = await checkEmailOtpRequest(request, reply);
			if (!emailMethod)
				return;

			const token = signToken(
				`email_totp:${emailMethod.method_id}:${generateRandomToken(16)}`
			);

			// --- Consume code ---
			const update = updateUser2faEmailOtp(emailMethod.email_otp_id, {
				consumed: 1,
				attempts: (emailMethod.attempts ?? 0) + 1,
			});

			if (!update)
				return reply.status(500).send({ message: 'Failed to verify code.' });

			return reply.status(200).send({ token });
		}
	);
}