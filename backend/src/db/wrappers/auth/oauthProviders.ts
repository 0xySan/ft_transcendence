/**
 * Wrapper functions for interacting with the `OauthProviders` table.
 * Provides retrieval, creation, and listing utilities.
*/

import { db, insertRow, getRow } from "../../index.js";

export interface OauthProvider {
	provider_id:				number;
	name:						string;
	discovery_url:				string;
	client_id:					string;
	client_secret_encrypted:	Buffer;
	is_enabled:					boolean;
	created_at:					number;
}

/**
 * Retrieve a OauthProvider by its ID.
 * @param id - The primary key of the OauthProvider
 * @returns The OauthProvider object if found, otherwise undefined
 */
export function getOauthProviderById(id: number): OauthProvider | undefined {
	return (getRow<OauthProvider>("oauth_providers", "provider_id", id));
}

/**
 * Retrieve a OauthProvider by its Name.
 * @param id - The primary key of the OauthProvider
 * @returns The OauthProvider object if found, otherwise undefined
 */
export function getOauthProviderByName(name: string): OauthProvider | undefined {
	return (getRow<OauthProvider>("oauth_providers", "name", name));
}

/**
 * Create a new OauthProvider if it doesn't exist.
 * Default values will be applied for missing fields.
 * Uses the generic insertRow wrapper to insert and fetch the OauthProvider.
 * 
 * @param options - Partial OauthProvider object with name, url, client_id, secret, enabled and date
 * @returns The newly created or existing OauthProvider object, or undefined if insertion failed
 */
export function createOauthProvider(options: Partial<OauthProvider>): OauthProvider | undefined {
	const	name = (options.name || "Unknown")
	const	discovery_url = (options.discovery_url || null)
	const	client_id = (options.client_id || null)
	const	client_secret_encrypted = (options.client_secret_encrypted || null)
	const	is_enabled = (options.is_enabled ?? true)
	const	created_at = Math.floor(Date.now() / 1000);

	return (insertRow<OauthProvider>("oauth_providers", {
		name: name,
		discovery_url: discovery_url,
		client_id: client_id,
		client_secret_encrypted: client_secret_encrypted,
		is_enabled: is_enabled ? 1 : 0,
		created_at: created_at
	}));
}

/**
 * Update OauthProvider.
 * Only updates the provided fields.
 * 
 * @param provider_id - The provider ID
 * @param options - Partial information to update
 * @returns true if updated, false otherwise
 */
export function updateOauthProvider(provider_id: number, options: Partial<OauthProvider>): boolean {
	const keys = Object.keys(options).filter(
		key => options[key as keyof OauthProvider] !== undefined && options[key as keyof OauthProvider] !== null
	);

	if (keys.length === 0) return false;

	const setClause = keys.map(key => `${key} = @${key}`).join(", ");

	const params: Record<string, unknown> = { provider_id };
	for (const key of keys) {
		if (key === "is_enabled") {
			params[key] = options.is_enabled ? 1 : 0;
		} else {
			params[key] = options[key as keyof OauthProvider];
		}
	}

	const stmt = db.prepare(`
		UPDATE oauth_providers
		SET ${setClause}
		WHERE provider_id = @provider_id
	`);

	const result = stmt.run(params);

	return (result.changes > 0);
}

/**
 * List all OauthProviders.
 * @param onlyEnabled - If true, only returns enabled providers
 * @returns Array of OauthProvider objects
 */
export function listOauthProviders(onlyEnabled = false): OauthProvider[] {
	try {
		const query = onlyEnabled
			? `SELECT * FROM oauth_providers WHERE is_enabled = 1 ORDER BY name ASC`
			: `SELECT * FROM oauth_providers ORDER BY name ASC`;
		const stmt = db.prepare(query);
		return stmt.all() as OauthProvider[];
	} catch (err) {
		return [];
	}
}
