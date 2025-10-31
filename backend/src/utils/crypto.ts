/**
 * @file crypto.ts
 * Utility functions for encryption and decryption of secrets.
 */

import crypto from 'crypto';
import dotenv from 'dotenv';
import argon2 from 'argon2';

dotenv.config({ quiet: true });

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || ''; // hex string
const IV_LENGTH = 16; // AES block size

/**
 * Encrypt a string using AES-256-CBC.
 * Returns a Buffer containing IV + encrypted data.
 * 
 * @param secret - The plaintext string to encrypt.
 * @throws Error if ENCRYPTION_KEY is missing.
 * @return Buffer - The encrypted data with IV prepended.
 */
export function encryptSecret(secret: string): Buffer {
	if (!ENCRYPTION_KEY) {
		throw new Error('ENCRYPTION_KEY is missing in .env. Cannot encrypt secrets.');
	}

	const iv = crypto.randomBytes(IV_LENGTH);
	const key = Buffer.from(ENCRYPTION_KEY, 'hex');
	const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
	const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);

	return Buffer.concat([iv, encrypted]);
}

/**
 * Decrypt a Buffer produced by encryptSecret.
 * Returns the original string.
 * 
 * @param encrypted - The Buffer containing IV + encrypted data.
 * @return string - The decrypted plaintext string.
 */
export function decryptSecret(encrypted: Buffer): string {
	if (!ENCRYPTION_KEY) {
		return '';
	}

	const iv = encrypted.subarray(0, IV_LENGTH);
	const data = encrypted.subarray(IV_LENGTH);

	const key = Buffer.from(ENCRYPTION_KEY, 'hex');
	const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
	const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);

	return decrypted.toString('utf8');
}

/**
 * Generate a random token of specified byte length.
 * 
 * @param length - The length in bytes of the token.
 * @return string - The generated token as a hex string.
 */
export function generateRandomToken(length: number): string {
	return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash a string using Argon2id (memory-hard hashing algorithm).
 * 
 * @param password - Plaintext password to hash.
 * @returns string - Argon2id hash including parameters & salt.
 */
export async function hashString(password: string): Promise<string> {
	return await argon2.hash(password, {
		type: argon2.argon2id,
		memoryCost: 19456, // ~19 MB
		timeCost: 2,
		parallelism: 1,
	});
}

/**
 * Verify a password against its Argon2id hash.
 * 
 * @param password - Plaintext password to verify.
 * @param hashed - Stored Argon2id hash.
 * @returns boolean - True if valid, false otherwise.
 */
export async function verifyHashedString(password: string, hashed: string): Promise<boolean> {
	if (typeof password !== 'string' || typeof hashed !== 'string') return false;
	if (password.length === 0 || password.length > 64) return false; // avoid doS with extremely long passwords

	try {
		return await argon2.verify(hashed, password);
	} catch {
		return false;
	}
}

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validate if a string is a valid UUID v7.
 * @param uuid - The string to validate.
 * @returns boolean - True if valid UUID v7, false otherwise.
 */
export function isValidUUIDv7(uuid: string): boolean {
	return uuidRegex.test(uuid);
}