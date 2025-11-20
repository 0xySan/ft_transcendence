import { describe, it, expect, beforeEach, vi } from 'vitest';
import fastify from 'fastify';
import emailSendRoutes from '../../../../src/routes/users/twoFa/email.route.js';

// --- Mocks ---
vi.mock('../../../../src/middleware/auth.middleware.js', () => ({
	requirePartialAuth: vi.fn((req, reply, done) => {
		(req as any).session = { user_id: 'user123', stage: 'partial', ip: '1.1.1.1' };
		done();
	}),
}));

vi.mock('../../../../src/utils/mail/mail.js', () => ({
	sendMail: vi.fn(() => undefined),
}));

vi.mock('../../../../src/db/index.js', () => ({
	getUser2faEmailOtpByMethodId: vi.fn(),
	getUser2FaMethodsByUserId: vi.fn(),
	getUserById: vi.fn(),
	updateUser2faEmailOtp: vi.fn(),
	getProfileByUserId: vi.fn(),
	getUser2FaMethodsById: vi.fn(),
	update2FaMethods: vi.fn(),
}));

vi.mock('../../../../src/utils/crypto.js', () => ({
	generateRandomToken: vi.fn(() => 'ABC123'),
	hashString: vi.fn((str: string) => `hashed_${str}`),
	signToken: vi.fn((s: string) => `signed_${s}`),
}));

vi.mock('../../../../src/utils/security.js', () => ({
	checkRateLimit: vi.fn(() => true),
}));

// --- Imports after mocks ---
import { sendMail } from '../../../../src/utils/mail/mail.js';
import {
	getUser2faEmailOtpByMethodId,
	getUser2FaMethodsById,
	update2FaMethods,
	updateUser2faEmailOtp,
	getProfileByUserId,
} from '../../../../src/db/index.js';
import { generateRandomToken, hashString } from '../../../../src/utils/crypto.js';
import { checkRateLimit } from '../../../../src/utils/security.js';

describe('Email 2FA routes - full coverage', () => {
	let app: ReturnType<typeof fastify>;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = fastify();
		await emailSendRoutes(app);
	});

	// -----------------------
	// /twofa/email/send tests
	// -----------------------
	describe('POST /twofa/email/send', () => {
		it('sends email successfully', async () => {
			(getProfileByUserId as any).mockReturnValue({ username: 'TestUser' });
			(getUser2faEmailOtpByMethodId as any).mockReturnValue({
				email_otp_id: 99,
				email: 'test@example.com',
				attempts: 0,
			});
			(updateUser2faEmailOtp as any).mockReturnValue(true);

			const res = await app.inject({
				method: 'POST',
				url: '/twofa/email/send',
				payload: { uuid: 'method-uuid-1' },
			});

			expect(res.statusCode).toBe(202);
			expect(res.json()).toEqual({ message: '2FA email sent successfully.' });
			expect(generateRandomToken).toHaveBeenCalledWith(6);
			expect(sendMail).toHaveBeenCalledWith(
				'test@example.com',
				expect.any(String),
				expect.any(String),
				expect.objectContaining({ VERIFICATION_CODE: 'ABC123' }),
				expect.stringContaining('@')
			);
		});

		it('returns 400 when method UUID missing', async () => {
			const res = await app.inject({
				method: 'POST',
				url: '/twofa/email/send',
				payload: {},
			});
			expect(res.statusCode).toBe(400);
			expect(res.json()).toEqual({ message: 'Method UUID is required.' });
		});

		it('returns 400 when profile not found', async () => {
			(getProfileByUserId as any).mockReturnValue(null);

			const res = await app.inject({
				method: 'POST',
				url: '/twofa/email/send',
				payload: { uuid: 'method-uuid-1' },
			});

			expect(res.statusCode).toBe(400);
			expect(res.json()).toEqual({ message: '2fa not found' });
		});

		it('returns 400 when email 2FA method not found', async () => {
			(getProfileByUserId as any).mockReturnValue({ username: 'TestUser' });
			(getUser2faEmailOtpByMethodId as any).mockReturnValue(null);

			const res = await app.inject({
				method: 'POST',
				url: '/twofa/email/send',
				payload: { uuid: 'method-uuid-1' },
			});

			expect(res.statusCode).toBe(400);
			expect(res.json()).toEqual({ message: '2fa not found' });
		});

		it('returns 500 when updateUser2faEmailOtp fails', async () => {
			(getProfileByUserId as any).mockReturnValue({ username: 'TestUser' });
			(getUser2faEmailOtpByMethodId as any).mockReturnValue({
				email_otp_id: 5,
				email: 'fail@example.com',
				attempts: 0,
			});
			(updateUser2faEmailOtp as any).mockReturnValue(false);

			const res = await app.inject({
				method: 'POST',
				url: '/twofa/email/send',
				payload: { uuid: 'method-uuid-1' },
			});

			expect(res.statusCode).toBe(500);
			expect(res.json()).toEqual({ message: 'Failed to send 2FA email.' });
		});

		it('returns 429 when ip rate limit triggered', async () => {
			(checkRateLimit as any).mockImplementationOnce(() => false);

			const res = await app.inject({
				method: 'POST',
				url: '/twofa/email/send',
				payload: { uuid: 'method-uuid-1' },
			});

			expect(res.statusCode).toBe(429);
			expect(res.json()).toEqual({ message: 'Rate limit exceeded. Please try again later.' });
		});

		it('returns 429 when user rate limit triggered', async () => {
			// first call true for ip, second false for user
			(checkRateLimit as any).mockImplementationOnce(() => true);
			(checkRateLimit as any).mockImplementationOnce(() => false);

			const res = await app.inject({
				method: 'POST',
				url: '/twofa/email/send',
				payload: { uuid: 'method-uuid-1' },
			});

			expect(res.statusCode).toBe(429);
			expect(res.json()).toEqual({ message: 'Rate limit exceeded. Please try again later.' });
		});

		it('returns 500 on unexpected exception', async () => {
			(getProfileByUserId as any).mockImplementation(() => {
				throw new Error('db oops');
			});

			const res = await app.inject({
				method: 'POST',
				url: '/twofa/email/send',
				payload: { uuid: 'method-uuid-1' },
			});

			expect(res.statusCode).toBe(500);
			expect(res.json()).toEqual({ message: 'Internal server error.' });
		});
	});

	// ------------------------------------
	// /twofa/email/validate (checkEmailOtp)
	// ------------------------------------
	describe('POST /twofa/email/validate', () => {
		it('validates code successfully', async () => {
			const emailOtp = {
				email_otp_id: 1,
				method_id: 42,
				last_sent_code_hash: 'hashed_ABC123',
				attempts: 0,
				expires_at: Date.now() + 60000,
			};
			(getUser2faEmailOtpByMethodId as any).mockReturnValue(emailOtp);
			(getUser2FaMethodsById as any).mockReturnValue({ method_id: 42, user_id: 'user123' });
			(update2FaMethods as any).mockReturnValue(true);
			(updateUser2faEmailOtp as any).mockReturnValue(true);
			(hashString as any).mockReturnValue('hashed_ABC123');

			const res = await app.inject({
				method: 'POST',
				url: '/twofa/email/validate',
				payload: { uuid: 'method-uuid-1', code: 'ABC123' },
			});

			expect(res.statusCode).toBe(200);
			expect(res.json()).toEqual({ message: 'Email code validated successfully.' });
			expect(update2FaMethods).toHaveBeenCalled();
			expect(updateUser2faEmailOtp).toHaveBeenCalled();
		});

		it('returns 400 on invalid code format', async () => {
			const res = await app.inject({
				method: 'POST',
				url: '/twofa/email/validate',
				payload: { uuid: 'method-uuid-1', code: 'abc' }, // lowercase -> fails regex
			});
			expect(res.statusCode).toBe(400);
			expect(res.json()).toEqual({ message: 'Invalid code format.' });
		});

		it('returns 400 when method UUID missing', async () => {
			const res = await app.inject({
				method: 'POST',
				url: '/twofa/email/validate',
				payload: { code: 'ABC123' },
			});
			expect(res.statusCode).toBe(400);
			expect(res.json()).toEqual({ message: 'UUID and code are required.' });
		});

		it('returns 401 when email OTP not found', async () => {
			(getUser2faEmailOtpByMethodId as any).mockReturnValue(null);

			const res = await app.inject({
				method: 'POST',
				url: '/twofa/email/validate',
				payload: { uuid: 'method-uuid-1', code: 'ABC123' },
			});
			expect(res.statusCode).toBe(401);
			expect(res.json()).toEqual({ message: 'Invalid code.' });
		});

		it('returns 401 when code expired', async () => {
			(getUser2faEmailOtpByMethodId as any).mockReturnValue({
				email_otp_id: 2,
				method_id: 42,
				last_sent_code_hash: 'hashed_ABC123',
				attempts: 0,
				expires_at: Date.now() - 1000,
			});

			const res = await app.inject({
				method: 'POST',
				url: '/twofa/email/validate',
				payload: { uuid: 'method-uuid-1', code: 'ABC123' },
			});
			expect(res.statusCode).toBe(401);
			expect(res.json()).toEqual({ message: 'Invalid code.' });
		});

		it('returns 401 when attempts exceeded', async () => {
			(getUser2faEmailOtpByMethodId as any).mockReturnValue({
				email_otp_id: 3,
				method_id: 42,
				last_sent_code_hash: 'hashed_ABC123',
				attempts: 5,
				expires_at: Date.now() + 10000,
			});
			const res = await app.inject({
				method: 'POST',
				url: '/twofa/email/validate',
				payload: { uuid: 'method-uuid-1', code: 'ABC123' },
			});
			expect(res.statusCode).toBe(401);
			expect(res.json()).toEqual({ message: 'Invalid code.' });
		});

		it('increments attempts and returns 401 on wrong code', async () => {
			(getUser2faEmailOtpByMethodId as any).mockReturnValue({
				email_otp_id: 4,
				method_id: 42,
				last_sent_code_hash: 'hashed_ABC123',
				attempts: 0,
				expires_at: Date.now() + 60000,
			});
			(hashString as any).mockReturnValue('hashed_WRONG');

			(updateUser2faEmailOtp as any).mockReturnValue(true);

			const res = await app.inject({
				method: 'POST',
				url: '/twofa/email/validate',
				payload: { uuid: 'method-uuid-1', code: 'WRONG1' },
			});

			expect(res.statusCode).toBe(401);
			expect(res.json()).toEqual({ message: 'Invalid code.' });
			expect(updateUser2faEmailOtp).toHaveBeenCalledWith(4, expect.objectContaining({ attempts: 1 }));
		});

		it('returns 500 when hashString throws', async () => {
			(getUser2faEmailOtpByMethodId as any).mockReturnValue({
				email_otp_id: 5,
				method_id: 42,
				last_sent_code_hash: 'hashed_ABC123',
				attempts: 0,
				expires_at: Date.now() + 60000,
			});
			(hashString as any).mockImplementation(() => {
				throw new Error('crypto fail');
			});

			const res = await app.inject({
				method: 'POST',
				url: '/twofa/email/validate',
				payload: { uuid: 'method-uuid-1', code: 'ABC123' },
			});

			expect(res.statusCode).toBe(500);
			expect(res.json()).toEqual({ message: 'Failed to verify code.' });
		});

		it('returns 401 if method belongs to another user', async () => {
			(getUser2faEmailOtpByMethodId as any).mockReturnValue({
				email_otp_id: 6,
				method_id: 50,
				last_sent_code_hash: 'hashed_ABC123',
				attempts: 0,
				expires_at: Date.now() + 60000,
			});
			(getUser2FaMethodsById as any).mockReturnValue({ method_id: 50, user_id: 'otherUser' });
			(hashString as any).mockReturnValue('hashed_ABC123');

			const res = await app.inject({
				method: 'POST',
				url: '/twofa/email/validate',
				payload: { uuid: 'method-uuid-1', code: 'ABC123' },
			});

			expect(res.statusCode).toBe(401);
			expect(res.json()).toEqual({ message: 'Invalid code.' });
		});

		it('returns 500 when update2FaMethods fails', async () => {
			(getUser2faEmailOtpByMethodId as any).mockReturnValue({
				email_otp_id: 7,
				method_id: 60,
				last_sent_code_hash: 'hashed_ABC123',
				attempts: 0,
				expires_at: Date.now() + 60000,
			});
			(getUser2FaMethodsById as any).mockReturnValue({ method_id: 60, user_id: 'user123' });
			(hashString as any).mockReturnValue('hashed_ABC123');
			(update2FaMethods as any).mockReturnValue(false);

			const res = await app.inject({
				method: 'POST',
				url: '/twofa/email/validate',
				payload: { uuid: 'method-uuid-1', code: 'ABC123' },
			});

			expect(res.statusCode).toBe(500);
			expect(res.json()).toEqual({ message: 'Failed to verify 2FA method.' });
		});

		it('returns 500 when consume update fails', async () => {
			(getUser2faEmailOtpByMethodId as any).mockReturnValue({
				email_otp_id: 8,
				method_id: 70,
				last_sent_code_hash: 'hashed_ABC123',
				attempts: 0,
				expires_at: Date.now() + 60000,
			});
			(getUser2FaMethodsById as any).mockReturnValue({ method_id: 70, user_id: 'user123' });
			(hashString as any).mockReturnValue('hashed_ABC123');
			(update2FaMethods as any).mockReturnValue(true);
			(updateUser2faEmailOtp as any).mockReturnValue(false);

			const res = await app.inject({
				method: 'POST',
				url: '/twofa/email/validate',
				payload: { uuid: 'method-uuid-1', code: 'ABC123' },
			});

			expect(res.statusCode).toBe(500);
			expect(res.json()).toEqual({ message: 'Failed to verify 2FA method.' });
		});
	});

	// -------------------------
	// /twofa/email (token flow)
	// -------------------------
	describe('POST /twofa/email', () => {
		it('returns token on valid code', async () => {
			const emailOtp = {
				email_otp_id: 9,
				method_id: 42,
				last_sent_code_hash: 'hashed_ABC123',
				attempts: 0,
				expires_at: Date.now() + 60000,
			};
			(getUser2faEmailOtpByMethodId as any).mockReturnValue(emailOtp);
			(hashString as any).mockReturnValue('hashed_ABC123');
			(updateUser2faEmailOtp as any).mockReturnValue(true);

			const res = await app.inject({
				method: 'POST',
				url: '/twofa/email',
				payload: { uuid: 'method-uuid-1', code: 'ABC123' },
			});

			expect(res.statusCode).toBe(200);
			expect(res.json()).toEqual({ token: `signed_email_totp:42:ABC123` });
		});

		it('returns 400 on invalid code format', async () => {
			const res = await app.inject({
				method: 'POST',
				url: '/twofa/email',
				payload: { uuid: 'method-uuid-1', code: 'abc' },
			});
			expect(res.statusCode).toBe(400);
			expect(res.json()).toEqual({ message: 'Invalid code format.' });
		});

		it('returns 401 on wrong code and increments attempts', async () => {
			(getUser2faEmailOtpByMethodId as any).mockReturnValue({
				email_otp_id: 10,
				method_id: 42,
				last_sent_code_hash: 'hashed_ABC123',
				attempts: 1,
				expires_at: Date.now() + 60000,
			});
			(hashString as any).mockReturnValue('hashed_WRONG');
			(updateUser2faEmailOtp as any).mockReturnValue(true);

			const res = await app.inject({
				method: 'POST',
				url: '/twofa/email',
				payload: { uuid: 'method-uuid-1', code: 'WRONG1' },
			});

			expect(res.statusCode).toBe(401);
			expect(res.json()).toEqual({ message: 'Invalid code.' });
			expect(updateUser2faEmailOtp).toHaveBeenCalledWith(10, expect.objectContaining({ attempts: 2 }));
		});

		it('returns 500 when hashString throws', async () => {
			(getUser2faEmailOtpByMethodId as any).mockReturnValue({
				email_otp_id: 11,
				method_id: 42,
				last_sent_code_hash: 'hashed_ABC123',
				attempts: 0,
				expires_at: Date.now() + 60000,
			});
			(hashString as any).mockImplementation(() => {
				throw new Error('crypto failure');
			});

			const res = await app.inject({
				method: 'POST',
				url: '/twofa/email',
				payload: { uuid: 'method-uuid-1', code: 'ABC123' },
			});

			expect(res.statusCode).toBe(500);
			expect(res.json()).toEqual({ message: 'Failed to verify code.' });
		});

		it('returns 500 when consume update fails', async () => {
			(getUser2faEmailOtpByMethodId as any).mockReturnValue({
				email_otp_id: 12,
				method_id: 42,
				last_sent_code_hash: 'hashed_ABC123',
				attempts: 0,
				expires_at: Date.now() + 60000,
			});
			(hashString as any).mockReturnValue('hashed_ABC123');
			(updateUser2faEmailOtp as any).mockReturnValue(false);

			const res = await app.inject({
				method: 'POST',
				url: '/twofa/email',
				payload: { uuid: 'method-uuid-1', code: 'ABC123' },
			});

			expect(res.statusCode).toBe(500);
			expect(res.json()).toEqual({ message: 'Failed to verify code.' });
		});
	});
});
