/**
 * @file routes/users/twoFa/emailSend.route.ts
 * @description Routes for handling Two-Factor Authentication (2FA) email sending.
 */

import { FastifyInstance } from 'fastify';

import { emailSendSchema } from '../../../plugins/swagger/schemas/emailSend.schema.js';

import { requireAuth } from '../../../middleware/auth.middleware.js';
import { getUser2faEmailOtpByMethodId, getUser2FaMethodsByUserId, getUserById, updateUser2faEmailOtp, getProfileByUserId } from '../../../db/index.js';
import { generateRandomToken, tokenHash } from '../../../utils/crypto.js';

import { sendMail } from "../../../utils/mail/mail.js";
import { checkRateLimit, delayResponse } from '../../../utils/security.js';

enum TwoFaMethodType {
	EMAIL = 0,
	AUTHENTICATOR_APP = 1,
	RECOVERY_CODE = 2,
}

const requestCount: Record<string, { count: number; lastReset: number }> = {};
const RATE_LIMIT = 5; // max 5 registrations per 15 minutes per IP
const RATE_WINDOW = 15 * 60 * 1000;
const MIN_DELAY = 500; // ms, minimum response time to prevent timing attacks

export default async function emailSendRoutes(fastify: FastifyInstance) {
	fastify.post(
		'/twofa/email/send',
		{
			preHandler: requireAuth,
			schema: emailSendSchema,
			validatorCompiler: ({ schema }) => {
				return () => true;
			},
		},
		async (request, reply) => {
			const startTime = Date.now();
			const session = (request as any).session;

			try {
				const { email } = request.body as { email?: string };

				if (!email) {
					return reply.status(400).send({ message: 'Email is required.' });
				}

				if (!checkRateLimit(requestCount, session.ip || 'unknown', reply, RATE_LIMIT, RATE_WINDOW)) {
					return reply.status(429).send({ message: 'Rate limit exceeded. Please try again later.' });
				}

				if (!checkRateLimit(requestCount, email, reply, RATE_LIMIT, RATE_WINDOW)) {
					return reply.status(429).send({ message: 'Rate limit exceeded. Please try again later.' });
				}

				if (session.stage !== 'partial') {
					return reply.status(400).send({ message: 'Forbidden: Invalid session stage.' });
				}

				const user = getUserById(session.user_id);
				if (!user) {
					return reply.status(400).send({ message: 'User not found.' });
				}

				const userProfile = getProfileByUserId(session.user_id);
				if (!userProfile) {
					return reply.status(400).send({ message: 'User profile not found.' });
				}

				const twofaMethods = await getUser2FaMethodsByUserId(session.user_id); // idk why but making it await fixes some test issues
				let emailMethod = twofaMethods.find((m: any) => m.method_type === TwoFaMethodType.EMAIL);

				if (!emailMethod) {
					return reply.status(400).send({ message: 'No email 2FA method configured for this account.' });
				}

				const emailOtpRecord = getUser2faEmailOtpByMethodId(emailMethod.method_id);
				if (!emailOtpRecord) {
					return reply.status(400).send({ message: 'No email OTP record found for this 2FA method.' });
				}

				const otp_code = generateRandomToken(6).toUpperCase();
				const hashed_otp = tokenHash(otp_code);

				updateUser2faEmailOtp(emailOtpRecord.email_otp_id, {
					last_sent_code_hash: hashed_otp,
					expires_at: startTime + 15 * 60 * 1000,
					last_sent_at: startTime,
					attempts: (emailOtpRecord.attempts ?? 0) + 1,
					consumed: 0,
				});

				sendMail(
					email,
					'Your ft_transcendence account: Access from new computer',
					'2faVerification.html',
					{
						HEADER: 'Access from new computer',
						USER_NAME: userProfile.username,
						VERIFICATION_CODE: otp_code,
						RESET_PASSWORD_URL: `${process.env.MAIL_DOMAIN || 'https://pong.moutig.sh'}/reset-password`,
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
}
