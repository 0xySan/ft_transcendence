/**
 * @file crypto.ts
 * Utility functions for encryption and decryption of secrets.
 */

import crypto from 'crypto';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

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
		// Dev mode: return raw secret
		return encrypted.toString('utf8');
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

// Hash a password
export async function hashPassword(password: string): Promise<string> {
	return await bcrypt.hash(password, SALT_ROUNDS);
}

// Verify a password
export async function verifyPassword(password: string, hashed: string): Promise<boolean> {
	return await bcrypt.compare(password, hashed);
}
