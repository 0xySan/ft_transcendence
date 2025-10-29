/**
 * @file oauthProvider.test.ts
 *
 * Integration tests for the OAuth provider seeder.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { seedOAuthProviders } from '../../../src/db/seeders/oauthProvider.js';
import { encryptSecret } from '../../../src/utils/crypto.js';

// Mock encryption to get predictable results
vi.mock('../../../src/utils/crypto.js', () => ({
	encryptSecret: (s: string) => `encrypted(${s})`
}));

describe('seedOAuthProviders (integration)', () => {
	let db: Database.Database;

	beforeEach(() => {
		db = new Database(':memory:');

		db.exec(`
			CREATE TABLE oauth_providers (
				name TEXT PRIMARY KEY,
				client_id TEXT NOT NULL,
				client_secret_encrypted TEXT NOT NULL,
				discovery_url TEXT NOT NULL
			);
		`);

		process.env.GOOGLE_CLIENT_ID = 'google_id';
		process.env.GOOGLE_CLIENT_SECRET = 'google_secret';
		process.env.GOOGLE_DISCOVERY_URL = 'https://accounts.google.com';

		process.env['42_CLIENT_ID'] = 'fortytwo_id';
		process.env['42_CLIENT_SECRET'] = 'fortytwo_secret';
		process.env['42_DISCOVERY_URL'] = 'https://api.intra.42.fr';

		process.env.GITHUB_CLIENT_ID = 'github_id';
		process.env.GITHUB_CLIENT_SECRET = 'github_secret';
		process.env.GITHUB_DISCOVERY_URL = 'https://github.com/login/oauth';

		process.env.DISCORD_CLIENT_ID = 'discord_id';
		process.env.DISCORD_CLIENT_SECRET = 'discord_secret';
		process.env.DISCORD_DISCOVERY_URL = 'https://discord.com/api/oauth2';
	});

	afterEach(() => {
		db.close();
		vi.restoreAllMocks();
		vi.resetModules();
	});

	it('should insert all valid OAuth providers into the database', () => {
		// Run the seeder
		seedOAuthProviders(db);

		// Fetch all rows after seeding
		const rows = db.prepare('SELECT * FROM oauth_providers ORDER BY name').all();

		expect(rows.length).toBe(4);

		// Check for expected content
		const expected = [
			{
				name: 'discord',
				client_id: 'discord_id',
				client_secret_encrypted: 'encrypted(discord_secret)',
				discovery_url: 'https://discord.com/api/oauth2'
			},
			{
				name: 'forty-two',
				client_id: 'fortytwo_id',
				client_secret_encrypted: 'encrypted(fortytwo_secret)',
				discovery_url: 'https://api.intra.42.fr'
			},
			{
				name: 'github',
				client_id: 'github_id',
				client_secret_encrypted: 'encrypted(github_secret)',
				discovery_url: 'https://github.com/login/oauth'
			},
			{
				name: 'google',
				client_id: 'google_id',
				client_secret_encrypted: 'encrypted(google_secret)',
				discovery_url: 'https://accounts.google.com'
			}
		];

		expect(rows).toEqual(expected);
	});

	it('should skip providers with missing environment variables', () => {
		// Remove one provider's env vars
		delete process.env.GOOGLE_CLIENT_ID;
		delete process.env.GOOGLE_CLIENT_SECRET;
		delete process.env.GOOGLE_DISCOVERY_URL;

		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		// Run seeder
		seedOAuthProviders(db);

		// Fetch rows
		const rows = db.prepare('SELECT * FROM oauth_providers ORDER BY name').all();

		// Only two providers should be inserted
		expect(rows.length).toBe(3);

		// Check that warning was logged
		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping google'));

		// Ensure google not in DB
		//@ts-expect-error
		const names = rows.map(r => r.name);
		expect(names).not.toContain('google');
		expect(names).toEqual(expect.arrayContaining(['forty-two', 'github', 'discord']));
	});
});
