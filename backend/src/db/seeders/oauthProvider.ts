/**
 * @file seedOAuthProviders.ts
 * 
 * @description
 * This script seeds the database with OAuth provider credentials
 * (e.g. Google, 42, GitHub). It reads environment variables from
 * the `.env` file, encrypts each provider's client secret using AES-256-CBC,
 * and inserts them into the database.
 * 
 * The script will abort if the ENCRYPTION_KEY is missing,
 * ensuring no plaintext secrets are stored in the database.
 */

import dotenv from 'dotenv';
dotenv.config({ quiet: true });

import crypto from 'crypto';
import Database from 'better-sqlite3';

// Encryption key (must be a 64-character hex string for AES-256)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';
const IV_LENGTH = 16; // AES block size in bytes

/**
 * Encrypts a given secret using AES-256-CBC.
 * Concatenates the IV and the encrypted data into a single Buffer
 * so it can be easily stored and later decrypted.
 *
 * @param secret - the plaintext secret to encrypt
 * @returns Buffer - IV + encrypted secret
 */
function encryptSecret(secret: string): Buffer {
	if (!ENCRYPTION_KEY) {
		throw new Error('ENCRYPTION_KEY is missing in .env. Cannot encrypt secrets.');
	}

	const iv = crypto.randomBytes(IV_LENGTH);
	const key = Buffer.from(ENCRYPTION_KEY, 'hex');

	const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
	const encrypted = Buffer.concat([
		cipher.update(secret, 'utf8'),
		cipher.final()
	]);

	// Return IV + encrypted data (used later for decryption)
	return Buffer.concat([iv, encrypted]);
}

/**
 * Interface representing environment variables for a single OAuth provider.
 */
interface OAuthProviderEnv {
	name: string;
	clientId?: string;
	clientSecret?: string;
	discoveryUrl?: string;
}

/**
 * List of OAuth providers to seed into the database.
 * Each provider reads its credentials from the environment.
 */
const providers: OAuthProviderEnv[] = [
	{
		name: 'google',
		clientId: process.env.GOOGLE_CLIENT_ID,
		clientSecret: process.env.GOOGLE_CLIENT_SECRET,
		discoveryUrl: process.env.GOOGLE_DISCOVERY_URL
	},
	{
		name: '42',
		clientId: process.env['42_CLIENT_ID'],
		clientSecret: process.env['42_CLIENT_SECRET'],
		discoveryUrl: process.env['42_DISCOVERY_URL']
	},
	{
		name: 'github',
		clientId: process.env.GITHUB_CLIENT_ID,
		clientSecret: process.env.GITHUB_CLIENT_SECRET,
		discoveryUrl: process.env.GITHUB_DISCOVERY_URL
	}
];

/**
 * Seeds the OAuth providers into the database.
 * Skips providers that are missing required environment variables.
 */
export function seedOAuthProviders(db: Database.Database): void {
	for (const p of providers) {
		if (!p.clientId || !p.clientSecret || !p.discoveryUrl) {
			console.warn(`⚠️  Skipping ${p.name}: missing environment variables`);
			continue;
		}

		const clientSecretEncrypted = encryptSecret(p.clientSecret);

		const insertStmt = db.prepare(`
			INSERT OR REPLACE INTO oauth_providers (name, client_id, client_secret_encrypted, discovery_url)
			VALUES (?, ?, ?, ?)
		`);

		insertStmt.run(p.name, p.clientId, clientSecretEncrypted, p.discoveryUrl);
		console.log(`✅ Seeded OAuth provider: ${p.name}`);
	}
}
