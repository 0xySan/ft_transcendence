/**
 * @file twoFa.test.ts
 * @description Unit and integration tests for 2FA routes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fastify from 'fastify';

// --- Mocks for external modules / DB wrappers ---
vi.mock('../../../../src/plugins/swagger/schemas/twoFa.schema.js', () => ({
	createTwoFaMethodsSchema: {},
	getTwoFaMethodsSchema: {},
	patchTwoFaSchema: {},
}));

vi.mock('../../../../src/middleware/auth.middleware.js', () => ({
	requirePartialAuth: vi.fn((req: any, reply: any, done: any) => {
		req.session = { user_id: 'user123' };
		done();
	}),
	requireAuth: vi.fn((req: any, reply: any, done: any) => {
		req.session = { user_id: 'user123' };
		done();
	}),
}));

vi.mock('../../../../src/db/wrappers/auth/2fa/user2FaMethods.js', () => ({
	create2FaMethods: vi.fn(() => ({ /* fake db row */ })),
	getAllMethodsByUserIdByType: vi.fn(() => []),
	getUser2FaMethodsByUserId: vi.fn(() => []),
	updateBatch2FaMethods: vi.fn(() => true),
}));

vi.mock('../../../../src/db/wrappers/auth/2fa/user2faEmailOtp.js', () => ({
	createUser2faEmailOtp: vi.fn(() => true),
	getUser2faEmailOtpsByMethodIds: vi.fn(() => []),
}));

vi.mock('../../../../src/utils/crypto.js', () => ({
	encryptSecret: vi.fn((s: string) => `${s}`),
	generateRandomToken: vi.fn(() => 'deadbeef'),
	hashString: vi.fn(async (s: string) => `hash:${s}`),
	verifyToken: vi.fn((token: string) => {
		return token === 'validtoken';
	}),
}));

vi.mock('../../../../src/auth/2Fa/totpUtils.js', () => ({
	createTotpUri: vi.fn(() => 'otpauth://totp/Transcendence:user@example.com?secret=SECRET'),
	generateTotpSecret: vi.fn(() => 'SECRET'),
}));

vi.mock('../../../../src/db/index.js', () => ({
	createUser2faTotp: vi.fn(() => true),
	createUser2faBackupCodes: vi.fn(() => true),
	getUserById: vi.fn((id: string) => ({ user_id: id, email: 'user@example.com' })),
	getProfileByUserId: vi.fn((id: string) => ({ username: 'testuser' })),
}));

vi.mock('../../../../src/auth/2Fa/qrCode/qrCode.js', () => ({
	generateQrCode: vi.fn(() => 'QR_DATA'),
}));

vi.mock('../../../../src/utils/mail/mail.js', () => ({
	sendMail: vi.fn(() => true),
}));

vi.mock('uuid', () => ({
	v7: vi.fn(() => 'fixed-uuid-1234')
}));

// Mock rate limit
vi.mock('../../../../src/utils/security.js', () => ({
	checkRateLimit: vi.fn(() => true),
	delayResponse: vi.fn(async () => {}),
}));

// --- Imports under test ---
import twoFaRoutes from '../../../../src/routes/users/twoFa/twoFa.route.js';
import { getUser2FaMethodsByUserId, getAllMethodsByUserIdByType, create2FaMethods, updateBatch2FaMethods } from '../../../../src/db/wrappers/auth/2fa/user2FaMethods.js';
import { getUser2faEmailOtpsByMethodIds, createUser2faEmailOtp } from '../../../../src/db/wrappers/auth/2fa/user2faEmailOtp.js';
import { requirePartialAuth } from '../../../../src/middleware/auth.middleware.js';
import { createUser2faTotp, createUser2faBackupCodes, getUserById } from '../../../../src/db/index.js';
import { generateTotpSecret, createTotpUri } from '../../../../src/auth/2Fa/totpUtils.js';
import { generateQrCode } from '../../../../src/auth/2Fa/qrCode/qrCode.js';
import { verifyToken } from '../../../../src/utils/crypto.js';

// typed mocked helpers
const mockedGetUser2FaMethodsByUserId = vi.mocked(getUser2FaMethodsByUserId);
const mockedGetAllMethodsByUserIdByType = vi.mocked(getAllMethodsByUserIdByType);
const mockedCreate2FaMethods = vi.mocked(create2FaMethods);
const mockedGetUser2faEmailOtpsByMethodIds = vi.mocked(getUser2faEmailOtpsByMethodIds);
const mockedCreateUser2faEmailOtp = vi.mocked(createUser2faEmailOtp);
const mockedRequirePartialAuth = vi.mocked(requirePartialAuth);
const mockedCreateUser2faTotp = vi.mocked(createUser2faTotp);
const mockedCreateUser2faBackupCodes = vi.mocked(createUser2faBackupCodes);
const mockedGetUserById = vi.mocked(getUserById);
const mockedGenerateTotpSecret = vi.mocked(generateTotpSecret);
const mockedCreateTotpUri = vi.mocked(createTotpUri);
const mockedGenerateQrCode = vi.mocked(generateQrCode);

describe('twoFaRoutes (routes/users/twoFa)', () => {
	let app: ReturnType<typeof fastify>;

	beforeEach(async () => {
		vi.resetAllMocks();
		app = fastify();
		// register routes
		await twoFaRoutes(app);
	});

	it('GET /twofa/ returns 200 with mapped twoFaMethods when present', async () => {
		mockedGetUser2FaMethodsByUserId.mockReturnValue([
			{ method_type: 0, label: 'Email', is_verified: true, is_primary: true, method_id: 'm0', user_id: 'user123', created_at: 123, updated_at: 124 },
			{ method_type: 1, label: 'TOTP', is_verified: true, is_primary: false, method_id: 'm1', user_id: 'user123', created_at: 124, updated_at: 125 },
		]);

		const res = await app.inject({ method: 'GET', url: '/twofa/' });
		expect(res.statusCode).toBe(200);
		const body = JSON.parse(res.body);
		expect(Array.isArray(body.twoFaMethods)).toBe(true);
		expect(body.twoFaMethods).toHaveLength(2);
		expect(body.twoFaMethods[0]).toMatchObject({ id: 'm0', method_type: 0, label: 'Email', is_primary: true, is_verified: true, created_at: 123 });
		expect(body.twoFaMethods[1]).toMatchObject({ id: 'm1', method_type: 1, label: 'TOTP', is_primary: false, is_verified: true });
	});

	it('GET /twofa/ returns 404 when no methods exist', async () => {
		mockedGetUser2FaMethodsByUserId.mockReturnValue([]);
		const res = await app.inject({ method: 'GET', url: '/twofa/' });
		expect(res.statusCode).toBe(404);
		const body = JSON.parse(res.body);
		expect(body).toMatchObject({ message: '2Fa is not set up for your account.' });
	});

	it('GET /twofa/ calls requirePartialAuth preHandler', async () => {
		mockedGetUser2FaMethodsByUserId.mockReturnValue([]);
		await app.inject({ method: 'GET', url: '/twofa/' });
		expect(mockedRequirePartialAuth).toHaveBeenCalled();
	});

	// ---------------- POST route tests ----------------
	it('POST /twofa/ returns 400 when no methods provided', async () => {
		const res = await app.inject({ method: 'POST', url: '/twofa/', payload: {} });
		expect(res.statusCode).toBe(400);
		const body = JSON.parse(res.body);
		expect(body).toMatchObject({ message: 'No 2FA methods provided.' });
	});

	it('POST /twofa/ handles invalid method object and returns result with error', async () => {
		const payload = { methods: [null] } as any;
		const res = await app.inject({ method: 'POST', url: '/twofa/', payload });
		expect(res.statusCode).toBe(201);
		const body = JSON.parse(res.body);
		expect(Array.isArray(body.results)).toBe(true);
		expect(body.results[0]).toMatchObject({ success: false, message: 'Invalid method object.' });
	});

	it('POST /twofa/ rejects when user not found', async () => {
		mockedGetUserById.mockReturnValue(undefined as any);
		const payload = { methods: [{ methodType: 1 }] };
		const res = await app.inject({ method: 'POST', url: '/twofa/', payload });
		expect(res.statusCode).toBe(404);
		const body = JSON.parse(res.body);
		expect(body).toMatchObject({ message: 'User not found.' });
	});

	it('POST /twofa/ enforces max methods per type', async () => {
		// mock a valid user
		mockedGetUserById.mockReturnValue({ user_id: 'user123', email: 'user@example.com' } as any);
		// simulate existing methods >= limit
		mockedGetAllMethodsByUserIdByType.mockReturnValue(new Array(10).fill(0).map((_, i) => ({ method_id: `existing${i}` })) as any);

		const payload = { methods: [{ methodType: 1 }] };
		const res = await app.inject({ method: 'POST', url: '/twofa/', payload });
		expect(res.statusCode).toBe(201);
		const body = JSON.parse(res.body);
		expect(body.results[0]).toMatchObject({ success: false, message: 'Maximum number of this 2FA method type reached.' });
	});

	it('POST /twofa/ rejects duplicate email OTP for same user', async () => {
		mockedGetUserById.mockReturnValue({ user_id: 'user123', email: 'user@example.com' } as any);
		// one existing method id
		mockedGetAllMethodsByUserIdByType.mockReturnValue([{ method_id: 'mExist' }] as any);
		// existing otp uses same email
		mockedGetUser2faEmailOtpsByMethodIds.mockReturnValue([{ method_id: 'mExist', email: 'dup@example.com' } as any]);

		const payload = { methods: [{ methodType: 0, params: { email: 'dup@example.com' } }] };
		const res = await app.inject({ method: 'POST', url: '/twofa/', payload });
		expect(res.statusCode).toBe(201);
		const body = JSON.parse(res.body);
		expect(body.results[0]).toMatchObject({ success: false, message: 'An Email OTP method with this email already exists.' });
	});

	it('POST /twofa/ creates Email OTP method successfully', async () => {
		mockedGetUserById.mockReturnValue({ user_id: 'user123', email: 'user@example.com' } as any);
		mockedGetAllMethodsByUserIdByType.mockReturnValue([] as any);
		mockedCreate2FaMethods.mockReturnValue({ method_id: 'new1' } as any);
		mockedCreateUser2faEmailOtp.mockReturnValue(true as any);

		const payload = { methods: [{ methodType: 0, params: { email: 'ok@example.com' }, label: 'My Email' }] };
		const res = await app.inject({ method: 'POST', url: '/twofa/', payload });
		expect(res.statusCode).toBe(201);
		const body = JSON.parse(res.body);
		expect(body.results[0]).toMatchObject({ methodType: 0, success: true });
		expect(mockedCreateUser2faEmailOtp).toHaveBeenCalled();
	});

	it('POST /twofa/ creates TOTP method successfully', async () => {
		mockedGetUserById.mockReturnValue({ user_id: 'user123', email: 'user@example.com' } as any);
		mockedGetAllMethodsByUserIdByType.mockReturnValue([] as any);
		mockedCreate2FaMethods.mockReturnValue({ method_id: 'new2' } as any);
		mockedCreateUser2faTotp.mockReturnValue(true as any);
		mockedGenerateTotpSecret.mockReturnValue('SECRET');
		mockedCreateTotpUri.mockReturnValue('otpauth://totp/Transcendence:user@example.com?secret=SECRET');
		mockedGenerateQrCode.mockReturnValue([[true]])

		const payload = { methods: [{ methodType: 1, label: 'Authenticator App' }] };
		const res = await app.inject({ method: 'POST', url: '/twofa/', payload });
		expect(res.statusCode).toBe(201);
		const body = JSON.parse(res.body);
		expect(body.results[0]).toMatchObject({ methodType: 1, success: true });
		expect(mockedCreateUser2faTotp).toHaveBeenCalled();
	});

	it ('POST /twofa/ set method as primary when it is the first method for the user', async () => {
		mockedGetUserById.mockReturnValue({ user_id: 'user123', email: 'example@example.com' } as any);
		mockedGetAllMethodsByUserIdByType.mockReturnValue([] as any);
		mockedCreate2FaMethods.mockReturnValue({ method_id: 'new1' } as any);
		const payload = { methods: [{ methodType: 1, label: 'Authenticator App' }] };
		const res = await app.inject({ method: 'POST', url: '/twofa/', payload });
		expect(res.statusCode).toBe(201);
		const body = JSON.parse(res.body);
		expect(body.results[0]).toMatchObject({ methodType: 1, success: true });
		expect(mockedCreate2FaMethods).toHaveBeenCalledWith(expect.objectContaining({
			is_primary: true
		}));
	});

	it('POST /twofa/ creates Backup Codes successfully', async () => {
		mockedGetUserById.mockReturnValue({ user_id: 'user123', email: 'user@example.com' } as any);
		mockedGetAllMethodsByUserIdByType.mockReturnValue([] as any);
		mockedCreate2FaMethods.mockReturnValue({ method_id: 'new3' } as any);
		mockedCreateUser2faBackupCodes.mockReturnValue(true as any);

		const payload = { methods: [{ methodType: 2, label: 'Backup Codes' }] };
		const res = await app.inject({ method: 'POST', url: '/twofa/', payload });
		expect(res.statusCode).toBe(201);
		const body = JSON.parse(res.body);
		expect(body.results[0]).toMatchObject({ methodType: 2, success: true });
		expect(mockedCreateUser2faBackupCodes).toHaveBeenCalled();
	});

	it('creates Email OTP successfully', async () => {
		mockedGetUserById.mockReturnValue({ user_id: 'user123', email: 'user@example.com' } as any);
		mockedGetAllMethodsByUserIdByType.mockReturnValue([] as any);
		mockedCreate2FaMethods.mockReturnValue({ method_id: 'new1' } as any);
		mockedCreateUser2faEmailOtp.mockReturnValue(true as any);

		const payload = { methods: [{ methodType: 0, params: { email: 'user@example.com' }, label: 'My Email' }] };
		const res = await app.inject({ method: 'POST', url: '/twofa/', payload });
		expect(res.statusCode).toBe(201);
		const body = JSON.parse(res.body);
		expect(body.results[0]).toMatchObject({ methodType: 0, success: true });
		expect(mockedCreateUser2faEmailOtp).toHaveBeenCalled();
	});

	it("Return Database error while creating subtype when DB wrapper throws", async () => {
		mockedGetUserById.mockReturnValue({ user_id: 'user123', email: 'auser@example.com' } as any);
		mockedGetAllMethodsByUserIdByType.mockReturnValue([] as any);
		mockedCreate2FaMethods.mockReturnValue({ method_id: 'new1' } as any);
		mockedCreateUser2faEmailOtp.mockImplementation(() => { throw new Error('DB failure'); });

		const payload = { methods: [{ methodType: 0, params: { email: 'auser@example.com' }, label: 'My Email' }] };
		const res = await app.inject({ method: 'POST', url: '/twofa/', payload });
		expect(res.statusCode).toBe(201);
		const body = JSON.parse(res.body);
		expect(body.results[0]).toMatchObject({
			methodType: 0,
			label: 'My Email',
			methodId: 'fixed-uuid-1234',
			success: false,
			message: 'Database error while creating subtype: DB failure'
		});
	});

	it('Return Database error while creating method row: when DB wrapper throws', async () => {
		mockedGetUserById.mockReturnValue({ user_id: 'user123', email: 'user@example.com' } as any);
		mockedCreate2FaMethods.mockImplementation(() => { throw new Error('DB failure'); });

		const payload = { methods: [{ methodType: 1, label: 'Authenticator App' }] };
		const res = await app.inject({ method: 'POST', url: '/twofa/', payload });
		expect(res.statusCode).toBe(201);
		const body = JSON.parse(res.body);
		expect(body.results[0]).toMatchObject({
			methodType: 1,
			label: 'Authenticator App',
			success: false,
			message: 'Database error while creating method row: DB failure'
		});
	});

	it('Return Failed to create 2FA method in database. when create2FaMethods returns null', async () => {
		mockedGetUserById.mockReturnValue({ user_id: 'user123', email: 'user@example.com' } as any);
		mockedCreate2FaMethods.mockReturnValue(null as any);
		
		const payload = { methods: [{ methodType: 1, label: 'Authenticator App' }] };
		const res = await app.inject({ method: 'POST', url: '/twofa/', payload });
		expect(res.statusCode).toBe(201);
		const body = JSON.parse(res.body);
		expect(body.results[0]).toMatchObject({
			methodType: 1,
			label: 'Authenticator App',
			success: false,
			message: 'Failed to create 2FA method in database.'
		});
	});

	it("Return 2FA token required to add more methods. when adding method without token and user has existing methods", async () => {
		mockedGetUserById.mockReturnValue({ user_id: 'user123', email: 'test@test.test' } as any);
		// simulate existing methods
		mockedGetUser2FaMethodsByUserId.mockReturnValue([{
			method_id: 'existing1',
			method_type: 1,
			label: 'Authenticator App',
			is_verified: true,
			is_primary: true,
			user_id: 'user123',
			created_at: 123,
			updated_at: 124
		}] as any);
		//mock verify token to return false
		const mockedVerifyToken = vi.mocked(verifyToken);
		mockedVerifyToken.mockReturnValue(null);


		const payload = { methods: [{ methodType: 1, label: 'Authenticator App' }] };
		const res = await app.inject({ method: 'POST', url: '/twofa/', payload });
		expect(res.statusCode).toBe(400);
		const body = JSON.parse(res.body);
		expect(body).toMatchObject({ message: '2FA token required to add more methods.' });
	});

	it ("Return Invalid or expired 2FA token. when verifyToken fails", async () => {
		mockedGetUserById.mockReturnValue({ user_id: 'user123', email: 'test@test.test' } as any);
		// simulate existing methods
		mockedGetUser2FaMethodsByUserId.mockReturnValue([{
			method_id: 'existing1',
			method_type: 1,
			label: 'Authenticator App',
			is_verified: true,
			is_primary: true,
			user_id: 'user123',
			created_at: 123,
			updated_at: 124
		}])

		const payload = { methods: [{ methodType: 1, label: 'Authenticator App' }], twoFaToken: 'invalidtoken' };
		const res = await app.inject({ method: 'POST', url: '/twofa/', payload });
		expect(res.statusCode).toBe(400);
		const body = JSON.parse(res.body);
		expect(body).toMatchObject({ message: 'Invalid or expired 2FA token.' });
	});

	it("Validates 2FA token successfully when adding method and user has existing methods", async () => {
		mockedGetUserById.mockReturnValue({ user_id: 'user123', email: 'test@test.test' } as any);
		// simulate existing methods
		mockedGetUser2FaMethodsByUserId.mockReturnValue([{
			method_id: 'existing1',
			method_type: 1,
			label: 'Authenticator App',
			is_verified: true,
			is_primary: true,
			user_id: 'user123',
			created_at: 123,
			updated_at: 124
		}] as any);
		//mock verify token to return true
		const mockedVerifyToken = vi.mocked(verifyToken);
		mockedVerifyToken.mockReturnValue("valid");

		const payload = { methods: [{ methodType: 1, label: 'Authenticator App' }], twoFaToken: 'validtoken' };
		const res = await app.inject({ method: 'POST', url: '/twofa/', payload });
		expect(res.statusCode).toBe(201);
		const body = JSON.parse(res.body);
		expect(body.results[0]).toMatchObject({ methodType: 1, success: true });
	});

	describe('PATCH /twofa/', () => {
		it('returns 400 when body is invalid', async () => {
			const res = await app.inject({
				method: 'PATCH',
				url: '/twofa',
				payload: { changes: {} } // missing token
			});
			expect(res.statusCode).toBe(400);
			expect(JSON.parse(res.body)).toMatchObject({ error: 'invalid request body' });
		});

		it('returns 400 when token is invalid', async () => {
			vi.mocked(verifyToken).mockReturnValue(null);
			const res = await app.inject({
				method: 'PATCH',
				url: '/twofa',
				payload: { token: 'bad', changes: { m1: { disable: true } } }
			});
			expect(res.statusCode).toBe(400);
			expect(JSON.parse(res.body)).toMatchObject({ error: 'invalid request body' });
		});

		it('updates label + primary successfully', async () => {
			mockedGetUser2FaMethodsByUserId.mockReturnValue([
				{ method_id: 'm1', label: 'Old', is_verified: true, is_primary: false },
				{ method_id: 'm2', label: 'Other', is_verified: true, is_primary: true }
			] as any);

			vi.mocked(verifyToken).mockReturnValue("valid");

			const res = await app.inject({
				method: 'PATCH',
				url: '/twofa',
				payload: {
					token: 'validtoken',
					changes: {
						m1: { label: 'NewLabel', is_primary: true },
						m2: { is_primary: false }
					}
				}
			});

			expect(res.statusCode).toBe(200);
			const body = JSON.parse(res.body);
			expect(body.results).toEqual([{ methodId: 'm1', success: true }, { methodId: 'm2', success: true }]);
			console.log(body);
		});

		it('returns 400 when disabling all methods', async () => {
			mockedGetUser2FaMethodsByUserId.mockReturnValue([
				{ method_id: 'm1', is_verified: true, is_primary: true }
			] as any);

			vi.mocked(verifyToken).mockReturnValue("true");

			const res = await app.inject({
				method: 'PATCH',
				url: '/twofa',
				payload: {
					token: 'validtoken',
					changes: { m1: { disable: true } }
				}
			});

			expect(res.statusCode).toBe(400);
			expect(JSON.parse(res.body)).toMatchObject({
				error: 'At least one verified 2FA method must remain active.'
			});
		});

		it('returns 400 when multiple methods are set primary', async () => {
			mockedGetUser2FaMethodsByUserId.mockReturnValue([
				{ method_id: 'm1', is_verified: true, is_primary: false },
				{ method_id: 'm2', is_verified: true, is_primary: true }
			] as any);

			vi.mocked(verifyToken).mockReturnValue("true");

			const res = await app.inject({
				method: 'PATCH',
				url: '/twofa',
				payload: {
					token: 'validtoken',
					changes: {
						m1: { is_primary: true }
					}
				}
			});

			expect(res.statusCode).toBe(400);
			expect(JSON.parse(res.body)).toMatchObject({
				error: 'Only one primary 2FA method can be set.'
			});
		});

		it('Auto assigns primary if none set after updates', async () => {
			mockedGetUser2FaMethodsByUserId.mockReturnValue([
				{ method_id: 'm1', is_verified: true, is_primary: true },
				{ method_id: 'm2', is_verified: true, is_primary: false }
			] as any);

			vi.mocked(verifyToken).mockReturnValue("true");

			const res = await app.inject({
				method: 'PATCH',
				url: '/twofa',
				payload: {
					token: 'validtoken',
					changes: {
						m1: { is_primary: false },
						m2: { label: 'NewLabel' }
					}
				}
			});

			console.log(res.body);
			expect(res.statusCode).toBe(200);
			const body = JSON.parse(res.body);
			expect(body.results).toEqual([{ methodId: 'm1', success: true }, { methodId: 'm2', success: true }]);
		});

		it('Try to verify protected method and fails gracefully', async () => {
			mockedGetUser2FaMethodsByUserId.mockReturnValue([
				{ method_id: 'm1', is_verified: false, is_primary: true, method_type: 0 },
				{ method_id: 'm2', is_verified: true, is_primary: false, method_type: 1 }
			] as any);

			vi.mocked(verifyToken).mockReturnValue("true");

			const res = await app.inject({
				method: 'PATCH',
				url: '/twofa',
				payload: {
					token: 'validtoken',
					changes: {
						m1: { disable: false }
					}
				}
			});
			expect(res.statusCode).toBe(200);
			const body = JSON.parse(res.body);
			expect(body.results).toEqual([{
				methodId: 'm1',
				success: false,
				message: 'Re-enabling 2FA methods is not allowed.'
			}]);
		});

		it('Invalid label length is handled gracefully', async () => {
			mockedGetUser2FaMethodsByUserId.mockReturnValue([
				{ method_id: 'm1', is_verified: true, is_primary: true }
			] as any);

			vi.mocked(verifyToken).mockReturnValue("true");

			const res = await app.inject({
				method: 'PATCH',
				url: '/twofa',
				payload: {
					token: 'validtoken',
					changes: {
						m1: { label: 'A'.repeat(300) } // too long
					}
				}
			});
			expect(res.statusCode).toBe(200);
			const body = JSON.parse(res.body);
			expect(body.results).toEqual([{
				methodId: 'm1',
				success: false,
				message: 'Invalid label'
			}]);
		});

		it("Non-existent methodId in changes is handled gracefully", async () => {
			mockedGetUser2FaMethodsByUserId.mockReturnValue([
				{ method_id: 'm1', is_verified: true, is_primary: true }
			] as any);

			vi.mocked(verifyToken).mockReturnValue("true");

			const res = await app.inject({
				method: 'PATCH',
				url: '/twofa',
				payload: {
					token: 'validtoken',
					changes: {
						nonexistent: { label: 'NewLabel' }
					}
				}
			});
			expect(res.statusCode).toBe(200);
			const body = JSON.parse(res.body);
			expect(body.results).toEqual([{
				methodId: 'nonexistent',
				success: false,
				message: 'Method not found'
			}]);
		});
	});

	it('PATCH return 500 if updateBatch2FaMethods throws', async () => {
		mockedGetUser2FaMethodsByUserId.mockReturnValue([
			{ method_id: 'm1', is_verified: true, is_primary: true }
		] as any);

		vi.mocked(verifyToken).mockReturnValue("true");
		vi.mocked(updateBatch2FaMethods).mockImplementation(() => { throw new Error('DB failure'); });

		const res = await app.inject({
			method: 'PATCH',
			url: '/twofa',
			payload: {
				token: 'validtoken',
				changes: {
					m1: { label: 'NewLabel' }
				}
			}
		});
		expect(res.statusCode).toBe(500);
		const body = JSON.parse(res.body);
		expect(body).toMatchObject({ error: 'Internal Server Error' });
	});

});