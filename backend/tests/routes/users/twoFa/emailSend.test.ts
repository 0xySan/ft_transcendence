import { describe, it, expect, beforeEach, vi } from 'vitest';
import fastify from 'fastify';
import emailSendRoutes from '../../../../src/routes/users/twoFa/emailSend.route.js';
import { createHash } from 'crypto';

// --- Mocks ---
vi.mock('../../../../src/middleware/auth.middleware.js', () => ({
	requireAuth: vi.fn((req, reply, done) => {
		(req as any).session = { user_id: 'user123', stage: 'partial', ip: '1.1.1.1' };
		done();
	}),
}));

vi.mock('../../../../src/utils/mail/mail.js', () => ({
	sendMail: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../src/db/index.js', () => ({
	getUser2faEmailOtpByMethodId: vi.fn(),
	getUser2FaMethodsByUserId: vi.fn(),
	getUserById: vi.fn(),
	updateUser2faEmailOtp: vi.fn(),
	getProfileByUserId: vi.fn(),
}));

vi.mock('../../../../src/utils/crypto.js', () => ({
	generateRandomToken: vi.fn(() => 'ABC123'),
	tokenHash: vi.fn((token: string) => 'hashed_' + token),
}));

vi.mock('../../../../src/utils/security.js', () => ({
	checkRateLimit: vi.fn(() => true),
	delayResponse: vi.fn(() => Promise.resolve()),
}));

// --- Imports after mocks ---
import { requireAuth } from '../../../../src/middleware/auth.middleware.js';
import { sendMail } from '../../../../src/utils/mail/mail.js';
import {
	getUserById,
	getUser2FaMethodsByUserId,
	getUser2faEmailOtpByMethodId,
	updateUser2faEmailOtp,
	getProfileByUserId,
} from '../../../../src/db/index.js';
import { generateRandomToken, tokenHash } from '../../../../src/utils/crypto.js';
import { checkRateLimit, delayResponse } from '../../../../src/utils/security.js';

describe('POST /twofa/email/send', () => {
	let app: ReturnType<typeof fastify>;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = fastify();
		await emailSendRoutes(app);
	});

	it('should send email successfully', async () => {
		(getUserById as any).mockResolvedValue({ id: 'user123', email: 'test@example.com' });
		(getProfileByUserId as any).mockResolvedValue({ username: 'TestUser' });
		(getUser2FaMethodsByUserId as any).mockResolvedValue([{ method_id: 1, method_type: 0 }]);
		(getUser2faEmailOtpByMethodId as any).mockResolvedValue({ email_otp_id: 99 });
		(tokenHash as any).mockImplementation((token: string) => 'hashed_' + token);

		const response = await app.inject({
			method: 'POST',
			url: '/twofa/email/send',
			payload: { user_id: 'user123', email: 'test@example.com' },
		});

		expect(response.statusCode).toBe(202); // <-- FIXED
		expect(response.json()).toEqual({ message: '2FA email sent successfully.' });

		expect(generateRandomToken).toHaveBeenCalledWith(6);
		expect(sendMail).toHaveBeenCalledWith(
			'test@example.com',
			expect.any(String),
			expect.any(String),
			expect.objectContaining({ VERIFICATION_CODE: 'ABC123' }),
			expect.stringContaining('@')
		);
	});


	it('should return 400 if user not found', async () => {
		(getUserById as any).mockReturnValue(null);

		const response = await app.inject({
			method: 'POST',
			url: '/twofa/email/send',
			payload: { user_id: 'user123', email: 'test@example.com' },
		});

		expect(response.statusCode).toBe(400);
		expect(response.json()).toEqual({ message: 'User not found.' });
	});

	it('should return 400 if no email 2FA method', async () => {
		(getUserById as any).mockReturnValue({ id: 'user123', email: 'test@example.com' });
		(getProfileByUserId as any).mockReturnValue({ username: 'TestUser' });
		(getUser2FaMethodsByUserId as any).mockReturnValue([]); // No EMAIL method

		const response = await app.inject({
			method: 'POST',
			url: '/twofa/email/send',
			payload: { user_id: 'user123', email: 'test@example.com' },
		});

		expect(response.statusCode).toBe(400);
		expect(response.json()).toEqual({ message: 'No email 2FA method configured for this account.' });
	});

	it('should return 400 if no email OTP record', async () => {
		(getUserById as any).mockReturnValue({ id: 'user123', email: 'test@example.com' });
		(getProfileByUserId as any).mockReturnValue({ username: 'TestUser' });
		(getUser2FaMethodsByUserId as any).mockReturnValue([{ method_id: 1, method_type: 0 }]); // EMAIL
		(getUser2faEmailOtpByMethodId as any).mockReturnValue(null); // No OTP record

		const response = await app.inject({
			method: 'POST',
			url: '/twofa/email/send',
			payload: { user_id: 'user123', email: 'test@example.com' },
		});

		expect(response.statusCode).toBe(400);
		expect(response.json()).toEqual({ message: 'No email OTP record found for this 2FA method.' });
	});

	it('should return 400 if session stage is invalid', async () => {
		(requireAuth as any).mockImplementation((req: any, reply: any, done: any) => {
			req.session = { user_id: 'user123', stage: 'invalid', ip: '127.0.0.1' };
			done();
		});

		const response = await app.inject({
			method: 'POST',
			url: '/twofa/email/send',
			payload: { user_id: 'user123', email: 'test@example.com' },
		});

		expect(response.statusCode).toBe(400);
		expect(response.json()).toEqual({ message: 'Forbidden: Invalid session stage.' });
	});

	it('should return 400 if user profile not found', async () => {
		// Mock session with stage 'partial'
		(requireAuth as any).mockImplementation((req: any, reply: any, done: any) => {
			(req as any).session = { user_id: 'user123', stage: 'partial', ip: '127.0.0.1' };
			done();
		});

		// Mock user and profile
		(getUserById as any).mockReturnValue({ id: 'user123', email: 'test@example.com' });
		(getProfileByUserId as any).mockReturnValue(null);

		const response = await app.inject({
			method: 'POST',
			url: '/twofa/email/send',
			payload: { user_id: 'user123', email: 'test@example.com' },
		});

		expect(response.statusCode).toBe(400);
		expect(response.json()).toEqual({ message: 'User profile not found.' });
	});

	it('should enforce rate limiting with ip', async () => {
		(checkRateLimit as any).mockImplementationOnce(() => false); // Simulate rate limit exceeded

		const response = await app.inject({
			method: 'POST',
			url: '/twofa/email/send',
			payload: { user_id: 'user123', email: 'test@example.com' },
		});

		expect(response.statusCode).toBe(429);
		expect(response.json()).toEqual({ message: 'Rate limit exceeded. Please try again later.' });
	});

	it('should enforce rate limiting with email', async () => {
		(checkRateLimit as any).mockImplementationOnce(() => true); // First call passes
		(checkRateLimit as any).mockImplementationOnce(() => false); // Second call fails

		(getUserById as any).mockReturnValue({ id: 'user123', email: 'test@example.com' });
		(getProfileByUserId as any).mockReturnValue({ username: 'TestUser' });
		(getUser2FaMethodsByUserId as any).mockReturnValue([{ method_id: 1, method_type: 0 }]); // EMAIL
		(getUser2faEmailOtpByMethodId as any).mockReturnValue({ otp: '123456', expires_at: new Date(Date.now() + 5 * 60 * 1000) }); // Valid OTP

		const response = await app.inject({
			method: 'POST',
			url: '/twofa/email/send',
			payload: { user_id: 'user123', email: 'test@example.com' },
		});

		expect(response.statusCode).toBe(429);
		expect(response.json()).toEqual({ message: 'Rate limit exceeded. Please try again later.' });
	});

	it('should return 400 if email is missing in payload', async () => {
		const response = await app.inject({
			method: 'POST',
			url: '/twofa/email/send',
			payload: { user_id: 'user123' }, // No email provided
		});

		expect(response.statusCode).toBe(400);
		expect(response.json()).toEqual({ message: 'Email is required.' });
	});

	it('should return 500 on unexpected errors', async () => {
		(getUserById as any).mockImplementation(() => {
			throw new Error('Database error');
		});

		const response = await app.inject({
			method: 'POST',
			url: '/twofa/email/send',
			payload: { user_id: 'user123', email: 'test@example.com' },
		});

		expect(response.statusCode).toBe(500);
		expect(response.json()).toEqual({ message: 'Internal server error.' });
	});
});