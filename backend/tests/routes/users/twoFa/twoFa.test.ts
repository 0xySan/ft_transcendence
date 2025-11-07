/**
 * @file backend/tests/routes/users/twoFa/twoFa.test.ts
 * @description Tests for Two-Factor Authentication (2FA) routes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fastify from 'fastify';

// --- Mock middleware requireAuth pour injecter session ---
vi.mock('../../../../src/middleware/auth.middleware.js', () => ({
	requireAuth: vi.fn((req, reply, done) => {
		(req as any).session = { user_id: 'user123' };
		done();
	}),
}));

// --- Mock DB wrapper ---
vi.mock('../../../../src/db/wrappers/auth/2fa/user2FaMethods.js', () => ({
	getUser2FaMethodsByUserId: vi.fn(),
}));

import twoFaRoutes from '../../../../src/routes/users/twoFa/twoFa.route.js';
import { getUser2FaMethodsByUserId } from '../../../../src/db/wrappers/auth/2fa/user2FaMethods.js';
import { requireAuth } from '../../../../src/middleware/auth.middleware.js';

// --- Typage correct des mocks ---
const mockedGetUser2FaMethodsByUserId = vi.mocked(getUser2FaMethodsByUserId);
const mockedRequireAuth = vi.mocked(requireAuth);

describe('twoFaRoutes', () => {
	let app: ReturnType<typeof fastify>;

	beforeEach(async () => {
		app = fastify();
		await twoFaRoutes(app);
	});

	it('should return 200 with verified 2FA methods', async () => {
		mockedGetUser2FaMethodsByUserId.mockReturnValue([
			{ method_type: 0, label: 'Email', is_verified: true, is_primary: true, method_id: 1, user_id: 'user123', created_at: 0, updated_at: 0 },
			{ method_type: 1, label: 'TOTP', is_verified: true, is_primary: false, method_id: 2, user_id: 'user123', created_at: 0, updated_at: 0 },
			{ method_type: 2, label: 'Backup', is_verified: false, is_primary: false, method_id: 3, user_id: 'user123', created_at: 0, updated_at: 0 },
		]);

		const response = await app.inject({
			method: 'GET',
			url: '/twofa/',
		});

		expect(response.statusCode).toBe(200);
		const body = JSON.parse(response.body);
		expect(body.twoFaMethods).toHaveLength(2);
		expect(body.twoFaMethods[0]).toEqual({
			method_type: 0,
			label: 'Email',
			is_primary: true,
		});
		expect(body.twoFaMethods[1]).toEqual({
			method_type: 1,
			label: 'TOTP',
			is_primary: false,
		});
	});

	it('should return 404 if no verified 2FA methods', async () => {
		mockedGetUser2FaMethodsByUserId.mockReturnValue([
			{ method_type: 0, label: 'Email', is_verified: false, is_primary: true, method_id: 1, user_id: 'user123', created_at: 0, updated_at: 0 },
		]);

		const response = await app.inject({
			method: 'GET',
			url: '/twofa/',
		});

		expect(response.statusCode).toBe(404);
		const body = JSON.parse(response.body);
		expect(body.message).toBe('2Fa is not set up for your account.');
	});

	it('should call requireAuth preHandler', async () => {
		mockedGetUser2FaMethodsByUserId.mockReturnValue([]);
		await app.inject({
			method: 'GET',
			url: '/twofa/',
		});

		expect(mockedRequireAuth).toHaveBeenCalled();
	});
});
