/**
 * @file crypto.test.ts
 * Tests for crypto.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('crypto utilities', () => {
	const ORIGINAL_KEY = process.env.ENCRYPTION_KEY;
	let cryptoModule: typeof import('../../src/utils/crypto.js');

	beforeEach(async () => {
		vi.restoreAllMocks();
		// Set a dummy 32-byte key (hex) for AES-256
		process.env.ENCRYPTION_KEY =
			'0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
		vi.resetModules(); // Re-import module to take new ENCRYPTION_KEY into account
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

	it('decryptSecret should return raw string if ENCRYPTION_KEY is missing', async () => {
		process.env.ENCRYPTION_KEY = '';
		vi.resetModules();
		cryptoModule = await import('../../src/utils/crypto.js');

		const buffer = Buffer.from('plaintext', 'utf8');
		const decrypted = cryptoModule.decryptSecret(buffer);
		expect(decrypted).toBe('plaintext');
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
		expect(token.length).toBe(32); // 16 bytes = 32 hex chars

		const token2 = cryptoModule.generateRandomToken(8);
		expect(token2.length).toBe(16);
	});

	it('encryptSecret generates different IVs for same input', () => {
		const secret = 'sameSecret';
		const enc1 = cryptoModule.encryptSecret(secret);
		const enc2 = cryptoModule.encryptSecret(secret);

		expect(enc1.equals(enc2)).toBe(false);
	});

	it('hashPassword should generate a valid bcrypt hash', async () => {
		const password = 'MySuperPassword';
		const hash = await cryptoModule.hashPassword(password);

		expect(hash).toMatch(/^\$2[aby]\$/);
		expect(hash.length).toBeGreaterThan(50);
		expect(hash).not.toBe(password);
	});

	it('verifyPassword should correctly validate hashed passwords', async () => {
		const password = 'SecurePass123!';
		const hash = await cryptoModule.hashPassword(password);

		const isValid = await cryptoModule.verifyPassword(password, hash);
		const isInvalid = await cryptoModule.verifyPassword('wrongPassword', hash);

		expect(isValid).toBe(true);
		expect(isInvalid).toBe(false);
	});

});
