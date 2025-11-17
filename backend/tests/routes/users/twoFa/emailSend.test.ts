import { describe, it, expect, beforeEach, vi } from 'vitest';
import fastify from 'fastify';
import emailSendRoutes from '../../../../src/routes/users/twoFa/emailSend.route.js';

// --- Mocks ---
vi.mock('../../../../src/middleware/auth.middleware.js', () => ({
	requirePartialAuth: vi.fn((req, reply, done) => {
		(req as any).session = { user_id: 'user123', stage: 'partial', ip: '1.1.1.1' };
		done();
	}),
}));

vi.mock('../../../../src/utils/mail/mail.js', () => ({
	sendMail: vi.fn(() => undefined), // <-- sync
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
	hashString: vi.fn((str: string) => `hashed_${str}`), // <-- sync
}));

vi.mock('../../../../src/utils/security.js', () => ({
	checkRateLimit: vi.fn(() => true),
	delayResponse: vi.fn(() => undefined), // <-- sync
}));

// --- Imports after mocks ---
import { requireAuth } from '../../../../src/middleware/auth.middleware.js';
import { sendMail } from '../../../../src/utils/mail/mail.js';
import {
	getUserById,
	getUser2FaMethodsByUserId,
	getUser2faEmailOtpByMethodId,
	getProfileByUserId,
	updateUser2faEmailOtp,
} from '../../../../src/db/index.js';
import { generateRandomToken, hashString } from '../../../../src/utils/crypto.js';
import { checkRateLimit } from '../../../../src/utils/security.js';

describe('POST /twofa/email/send', () => {
	let app: ReturnType<typeof fastify>;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = fastify();
		await emailSendRoutes(app);
	});

	it('should send email successfully', async () => {
		(getUserById as any).mockReturnValue({ id: 'user123', email: 'test@example.com' });
		(getProfileByUserId as any).mockReturnValue({ username: 'TestUser' });
		(getUser2FaMethodsByUserId as any).mockReturnValue([{ method_id: 1, method_type: 0 }]);
		(getUser2faEmailOtpByMethodId as any).mockReturnValue({ email_otp_id: 99 });
		(updateUser2faEmailOtp as any).mockReturnValue(undefined);
		(hashString as any).mockReturnValue('hashed_ABC123');

		const response = await app.inject({
			method: 'POST',
			url: '/twofa/email/send',
			payload: { user_id: 'user123', email: 'test@example.com' },
		});

		expect(response.statusCode).toBe(202);
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
		expect(response.json()).toEqual({
			message: 'No email 2FA method configured for this account.',
		});
	});

	it('should return 400 if no email OTP record', async () => {
		(getUserById as any).mockReturnValue({ id: 'user123', email: 'test@example.com' });
		(getProfileByUserId as any).mockReturnValue({ username: 'TestUser' });
		(getUser2FaMethodsByUserId as any).mockReturnValue([{ method_id: 1, method_type: 0 }]); // EMAIL
		(getUser2faEmailOtpByMethodId as any).mockReturnValue(null);

		const response = await app.inject({
			method: 'POST',
			url: '/twofa/email/send',
			payload: { user_id: 'user123', email: 'test@example.com' },
		});

		expect(response.statusCode).toBe(400);
		expect(response.json()).toEqual({
			message: 'No email OTP record found for this 2FA method.',
		});
	});

	it('should return 400 if user profile not found', async () => {
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
		(checkRateLimit as any).mockImplementationOnce(() => false);

		const response = await app.inject({
			method: 'POST',
			url: '/twofa/email/send',
			payload: { user_id: 'user123', email: 'test@example.com' },
		});

		expect(response.statusCode).toBe(429);
		expect(response.json()).toEqual({
			message: 'Rate limit exceeded. Please try again later.',
		});
	});

	it('should enforce rate limiting with email', async () => {
		(checkRateLimit as any).mockImplementationOnce(() => true);
		(checkRateLimit as any).mockImplementationOnce(() => false);

		(getUserById as any).mockReturnValue({ id: 'user123', email: 'test@example.com' });
		(getProfileByUserId as any).mockReturnValue({ username: 'TestUser' });
		(getUser2FaMethodsByUserId as any).mockReturnValue([{ method_id: 1, method_type: 0 }]);
		(getUser2faEmailOtpByMethodId as any).mockReturnValue({
			otp: '123456',
			expires_at: new Date(Date.now() + 300000),
		});

		const response = await app.inject({
			method: 'POST',
			url: '/twofa/email/send',
			payload: { user_id: 'user123', email: 'test@example.com' },
		});

		expect(response.statusCode).toBe(429);
		expect(response.json()).toEqual({
			message: 'Rate limit exceeded. Please try again later.',
		});
	});

	it('should return 400 if email is missing', async () => {
		const response = await app.inject({
			method: 'POST',
			url: '/twofa/email/send',
			payload: { user_id: 'user123' },
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