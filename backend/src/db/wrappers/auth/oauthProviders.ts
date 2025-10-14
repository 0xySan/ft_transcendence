/**
 * Wrapper functions for interacting with the `oauth_providers` table.
 * Provides retrieval, creation, and listing utilities.
 */

import { db, insertRow, getRow } from "../../index.js";

/** --- Types --- */
export interface OAuthProvider {
	provider_id: number;
	name: string;
	discovery_url: string | null;
	client_id: string | null;
	client_secret_encrypted: Buffer | null;
	is_enabled: boolean;
	created_at: string | null;
}

/**
 * Retrieve an oauth provider by its ID.
 * @param id - The primary key of the oauth provider
 * @returns The oauth provider object if found, otherwise undefined
 */
export function getOAuthProviderById(id: number): OAuthProvider | undefined {
	return getRow<OAuthProvider>("oauth_providers", "provider_id", id);
}

/**
 * Retrieve an oauth provider by its name.
 * @param name - The unique name of the oauth provider
 * @returns The oauth provider object if found, otherwise undefined
 */
export function getOAuthProviderByName(name: string): OAuthProvider | undefined {
	return getRow<OAuthProvider>("oauth_providers", "name", name);
}

/**
 * Retrieve an oauth provider by its discovery URL.
 * @param url - The discovery URL of the oauth provider
 * @returns The oauth provider object if found, otherwise undefined
 */
export function getOAuthProviderByDiscoveryUrl(url: string): OAuthProvider | undefined {
	return getRow<OAuthProvider>("oauth_providers", "discovery_url", url);
}

/**
 * Create a new oauth provider if it doesn't exist.
 * Default values will be applied for missing fields.
 * Uses the generic insertRow wrapper to insert and fetch the provider.
 *
 * @param options - Partial provider object with common fields
 * @returns The newly created or existing provider object, or undefined if insertion failed
 */
export function createOAuthProvider(options: Partial<OAuthProvider>): OAuthProvider | undefined {
	const name = options.name || "unknown_provider";
	const discoveryUrl = options.discovery_url || null;
	const clientId = options.client_id || null;
	const clientSecret = options.client_secret_encrypted || null;
	const isEnabled = typeof options.is_enabled === "boolean" ? options.is_enabled : true;
	const createdAt = options.created_at || new Date().toISOString();

	const provider = insertRow<OAuthProvider>("oauth_providers", {
		name: name,
		discovery_url: discoveryUrl,
		client_id: clientId,
		client_secret_encrypted: clientSecret,
		is_enabled: isEnabled,
		created_at: createdAt,
	});

	// If row already existed or insert failed → try to get it manually by name
	if (!provider) {
		const existing = db.prepare(
			`SELECT * FROM oauth_providers WHERE name = ?`
		).get(name) as OAuthProvider | undefined;
		return existing;
	}

	return provider;
}

/**
 * List all oauth providers ordered by name.
 * @returns An array of all oauth provider objects
 */
export function getAllOAuthProviders(): OAuthProvider[] {
	const stmt = db.prepare(`
		SELECT * FROM oauth_providers
		ORDER BY name
	`);
	return stmt.all() as OAuthProvider[];
}
