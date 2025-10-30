/**
 * @file crypto.test.ts
 * Tests for crypto.ts (argon2 + AES)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('crypto utilities', () => {
	const ORIGINAL_KEY = process.env.ENCRYPTION_KEY;
	let cryptoModule: typeof import('../../src/utils/crypto.js');

	beforeEach(async () => {
		vi.restoreAllMocks();
		process.env.ENCRYPTION_KEY =
			'0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
		vi.resetModules();
		cryptoModule = await import('../../src/utils/crypto.js');
	});

	afterEach(() => {
		process.env.ENCRYPTION_KEY = ORIGINAL_KEY;
	});

	it('encryptSecret should encrypt and decrypt correctly', () => {
		const secret = 'mySecret123';
		const encrypted = cryptoModule.encryptSecret(secret);

		expect(encrypted).toBeInstanceOf(Buffer);
		expect(encrypted.length).toBeGreaterThan(secret.length);

		const decrypted = cryptoModule.decryptSecret(encrypted);
		expect(decrypted).toBe(secret);
	});

	it('decryptSecret should return the original secret', () => {
		process.env.ENCRYPTION_KEY = '';
		vi.resetModules();

		const secret = 'anotherSecret';
		const encrypted = cryptoModule.encryptSecret(secret);

		const decrypted = cryptoModule.decryptSecret(encrypted);
		expect(decrypted).toBe(secret);
	});

	it('encryptSecret should throw if ENCRYPTION_KEY is missing', async () => {
		process.env.ENCRYPTION_KEY = '';
		vi.resetModules();
		cryptoModule = await import('../../src/utils/crypto.js');

		expect(() => cryptoModule.encryptSecret('test')).toThrow(
			/ENCRYPTION_KEY is missing/
		);
	});

	it('generateRandomToken should produce hex string of correct length', () => {
		const token = cryptoModule.generateRandomToken(16); // 16 bytes
		expect(token).toMatch(/^[0-9a-f]+$/);
		expect(token.length).toBe(32);

		const token2 = cryptoModule.generateRandomToken(8);
		expect(token2.length).toBe(16);
	});

	it('encryptSecret generates different IVs for same input', () => {
		const secret = 'sameSecret';
		const enc1 = cryptoModule.encryptSecret(secret);
		const enc2 = cryptoModule.encryptSecret(secret);

		expect(enc1.equals(enc2)).toBe(false);
	});

	it('hashString should generate a valid argon2id hash', async () => {
		const password = 'MySuperPassword';
		const hash = await cryptoModule.hashString(password);

		expect(hash).toMatch(/^\$argon2id\$v=\d+\$m=\d+,t=\d+,p=\d+\$/);
		expect(hash.length).toBeGreaterThan(50);
		expect(hash).not.toBe(password);
	});

	it('verifyHashedString should correctly validate hashed passwords', async () => {
		const password = 'SecurePass123!';
		const hash = await cryptoModule.hashString(password);

		const isValid = await cryptoModule.verifyHashedString(password, hash);
		const isInvalid = await cryptoModule.verifyHashedString('wrongPassword', hash);

		expect(isValid).toBe(true);
		expect(isInvalid).toBe(false);
	});

	it('verifyHashedString should reject invalid inputs', async () => {
		const hash = await cryptoModule.hashString('password');
		expect(await cryptoModule.verifyHashedString('', hash)).toBe(false);
		expect(await cryptoModule.verifyHashedString('a'.repeat(65), hash)).toBe(false);
		expect(await cryptoModule.verifyHashedString('password', '')).toBe(false);
		expect(await cryptoModule.verifyHashedString('password', null as any)).toBe(false);
		expect(await cryptoModule.verifyHashedString(null as any, hash)).toBe(false);
	});
});