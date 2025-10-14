/**
 * Wrapper functions for interacting with the `oauthProviders` table.
 * Provides retrieval, creation, and listing utilities.
*/

import { db, insertRow, getRow } from "../../index.js";

export interface oauthProviders {
	provider_id:				number;
	name:						string;
	discovery_url:				string;
	client_id:					string;
	client_secret_encrypted:	Buffer;
	is_enabled:					boolean;
	created_at:					number;
}

/**
 * Retrieve a oauthProviders by its ID.
 * @param id - The primary key of the oauthProviders
 * @returns The oauthProviders object if found, otherwise undefined
 */
export function getOauthProvidersById(id: number): oauthProviders | undefined {
	return (getRow<oauthProviders>("oauth_providers", "provider_id", id));
}

/**
 * Retrieve a oauthProviders by its Name.
 * @param id - The primary key of the oauthProviders
 * @returns The oauthProviders object if found, otherwise undefined
 */
export function getOauthProvidersByName(name: string): oauthProviders | undefined {
	return (getRow<oauthProviders>("oauth_providers", "name", name));
}

/**
 * Create a new oauthProviders if it doesn't exist.
 * Default values will be applied for missing fields.
 * Uses the generic insertRow wrapper to insert and fetch the country.
 * 
 * @param options - Partial oauthProviders object with name, url, client_id, secret, enabled and date
 * @returns The newly created or existing oauthProviders object, or undefined if insertion failed
 */
export function createOauthProviders(options: Partial<oauthProviders>): oauthProviders | undefined {
	const	name = (options.name || "Unknown")
	const	discovery_url = (options.discovery_url || null)
	const	client_id = (options.client_id || null)
	const	client_secret_encrypted = (options.client_secret_encrypted || null)
	const	is_enabled = (options.is_enabled ?? true)
	const	created_at = Math.floor(Date.now() / 1000);

	const	new_row = insertRow<oauthProviders>("oauth_providers", {
		name: name,
		discovery_url: discovery_url,
		client_id: client_id,
		client_secret_encrypted: client_secret_encrypted,
		is_enabled: is_enabled ? 1 : 0,
		created_at: created_at
	});

	if (!new_row) { return (undefined); }

	return (new_row);
}

/**
 * Update oauthProviders.
 * Only updates the provided fields.
 * 
 * @param provider_id - The provider ID
 * @param options - Partial information to update
 * @returns true if updated, false otherwise
 */
export function updateOauthProviders(provider_id: number, options: Partial<oauthProviders>): boolean {
	const keys = Object.keys(options).filter(
		key => options[key as keyof oauthProviders] !== undefined && options[key as keyof oauthProviders] !== null
	);

	if (keys.length === 0) return false;

	const setClause = keys.map(key => `${key} = @${key}`).join(", ");

	// Prépare un nouvel objet params en convertissant is_enabled en int si présent
	const params: Record<string, unknown> = { provider_id };
	for (const key of keys) {
		if (key === "is_enabled") {
			params[key] = options.is_enabled ? 1 : 0;
		} else {
			params[key] = options[key as keyof oauthProviders];
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
