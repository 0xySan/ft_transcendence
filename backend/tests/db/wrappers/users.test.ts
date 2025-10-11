import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getAllUsers } from '../../../src/db/wrappers/users';

describe('User wrapper', () => {
	it('should fetch users successfully', async () => {
		const users = getAllUsers();
		expect(Array.isArray(users)).toBe(true);
	});
});
