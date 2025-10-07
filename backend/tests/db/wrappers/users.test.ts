import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getAllUsers } from '../../../src/db/wrappers/users';
import { initDb, closeDb } from '../../helpers/db'

describe('User wrapper', () => {
	beforeAll(async () => {
		initDb();
	});

	afterAll(async () => {
		closeDb();
	});

	it('should fetch users successfully', async () => {
		const users = getAllUsers();
		expect(Array.isArray(users)).toBe(true);
	});
});
