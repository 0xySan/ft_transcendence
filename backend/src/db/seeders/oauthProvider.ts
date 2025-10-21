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

import Database from 'better-sqlite3';

import { encryptSecret } from '../../utils/crypto.js';

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
 * Seeds the OAuth providers into the database.
 * Skips providers that are missing required environment variables.
 */
export function seedOAuthProviders(db: Database.Database): void {

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
