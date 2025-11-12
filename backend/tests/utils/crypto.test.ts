/**
 * @file crypto.test.ts
 * Tests for crypto.ts (argon2 + AES)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanUsedTokens, twofaTokens } from '../../src/utils/crypto.js';

describe('crypto utilities', () => {
	const ORIGINAL_KEY = process.env.ENCRYPTION_KEY;
	let cryptoModule: typeof import('../../src/utils/crypto.js');

	beforeEach(async () => {
		vi.restoreAllMocks();
		process.env.ENCRYPTION_KEY =
			'0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
		process.env.TOKEN_HMAC_KEY =
			'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
		process.env.SIGN_KEY =
			'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
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

	it("signToken should produce a valid base64 token", () => {
    const payload = "user:1234";
    const token = cryptoModule.signToken(payload, 60);

    expect(typeof token).toBe("string");
    const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf8"));
    expect(decoded).toHaveProperty("data");
    expect(decoded).toHaveProperty("hmac");
  });

  it("verifyToken should return the payload if valid", () => {
    const payload = "user:5678";
    const token = cryptoModule.signToken(payload, 60);

    const result = cryptoModule.verifyToken(token);
    expect(result).toBe(payload);
  });

  it("verifyToken should return null for already used tokens", () => {
    const payload = "user:9012";
    const token = cryptoModule.signToken(payload, 60);

    const first = cryptoModule.verifyToken(token);
    const second = cryptoModule.verifyToken(token);

    expect(first).toBe(payload);
    expect(second).toBeNull();
  });

  it("verifyToken should return null for expired tokens", async () => {
    const payload = "expiredUser";
    const token = cryptoModule.signToken(payload, 0); // expire immediately

    await new Promise(r => setTimeout(r, 10));
    const result = cryptoModule.verifyToken(token);

    expect(result).toBeNull();
  });

  it("verifyToken should return null for tampered tokens", () => {
    const payload = "user:tamper";
    const token = cryptoModule.signToken(payload, 60);

    const tampered = Buffer.from(token, "base64").toString("utf8").replace(payload, "hacker");
    const tamperedToken = Buffer.from(tampered).toString("base64");

    const result = cryptoModule.verifyToken(tamperedToken);
    expect(result).toBeNull();
  });

  it("tokenHash should produce consistent HMAC", () => {
    const token = "mySecretToken";
    const hash1 = cryptoModule.tokenHash(token);
    const hash2 = cryptoModule.tokenHash(token);

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("twofaTokens storage and cleanup", () => {
	beforeEach(() => {
		twofaTokens.clear();
	});

	it("should store a token with expiration", () => {
		const key = "token1";
		const exp = Date.now() + 1000; // 1 second
		twofaTokens.set(key, exp);

		expect(twofaTokens.has(key)).toBe(true);
		expect(twofaTokens.get(key)).toBe(exp);
	});

	it("should remove expired tokens when cleaning", async () => {
		const key1 = "token1";
		const key2 = "token2";
		const now = Date.now();

		twofaTokens.set(key1, now - 10); // already expired
		twofaTokens.set(key2, now + 1000); // not expired

		cleanUsedTokens();

		expect(twofaTokens.has(key1)).toBe(false);
		expect(twofaTokens.has(key2)).toBe(true);
	});

	it("should clean tokens automatically after interval", async () => {
		const key = "token1";
		const exp = Date.now() + 20; // expires in 20ms
		twofaTokens.set(key, exp);

		expect(twofaTokens.has(key)).toBe(true);

		// Wait for 50ms to ensure token is expired and cleanup runs
		await new Promise(r => setTimeout(r, 50));
		cleanUsedTokens();

		expect(twofaTokens.has(key)).toBe(false);
	});
});