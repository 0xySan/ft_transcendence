/**
 * @file oauthProviders.test.ts
 * @description Unit tests for the OAuthProviders database wrapper.
 * These tests verify that all CRUD-like operations on the `oauth_providers` table
 * behave as expected.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
	getOAuthProviderById,
	getOAuthProviderByName,
	getOAuthProviderByDiscoveryUrl,
	createOAuthProvider,
	getAllOAuthProviders
} from "../../../../src/db/wrappers/auth/oauthProviders.js";

/**
 * Test suite for the OAuthProviders wrapper.
 * Uses a seeded SQLite database (in-memory for tests).
 */
describe("OAuthProviders wrapper", () => {

	let defaultProvidersCount = 0;

	// --- Insert default providers before all tests --------------------------
	beforeAll(() => {
		const defaults = [
			{
				name: "provider1",
				discovery_url: "https://example.com/provider1/.well-known/openid-configuration",
				client_id: "client1",
				client_secret_encrypted: Buffer.from("secret1"),
				is_enabled: true
			},
			{
				name: "provider2",
				discovery_url: "https://example.com/provider2/.well-known/openid-configuration",
				client_id: "client2",
				client_secret_encrypted: Buffer.from("secret2"),
				is_enabled: true
			}
		];

		for (const provider of defaults) {
			createOAuthProvider(provider);
		}

		const all = getAllOAuthProviders();
		defaultProvidersCount = all.length;
	});

	// --- Seeder verification (skip until seeder is ready) -------------------

	it.skip("should have seeded the oauth_providers table with data", () => {
		const all = getAllOAuthProviders();
		expect(all.length).toBeGreaterThan(defaultProvidersCount);
	});

	// --- Tests for retrieval by ID ------------------------------------------

	it("should return a provider by ID", () => {
		const all = getAllOAuthProviders();
		const firstId = all[0]?.provider_id;
		const provider = getOAuthProviderById(firstId);
		expect(provider).toBeDefined();
		expect(provider?.provider_id).toBe(firstId);
	});

	it("should return undefined if ID does not exist", () => {
		const result = getOAuthProviderById(999999);
		expect(result).toBeUndefined();
	});

	// --- Tests for retrieval by name ----------------------------------------

	it("should return a provider by its name", () => {
		const all = getAllOAuthProviders();
		const name = all[0]?.name;
		const provider = getOAuthProviderByName(name!);
		expect(provider).toBeDefined();
		expect(provider?.name).toBe(name);
	});

	it("should return undefined for an unknown name", () => {
		const result = getOAuthProviderByName("nonexistent_provider");
		expect(result).toBeUndefined();
	});

	// --- Tests for retrieval by discovery URL --------------------------------

	it("should return a provider by its discovery URL", () => {
		const all = getAllOAuthProviders();
		const url = all[0]?.discovery_url;
		if (url) {
			const provider = getOAuthProviderByDiscoveryUrl(url);
			expect(provider).toBeDefined();
			expect(provider?.discovery_url).toBe(url);
		}
	});

	it("should return undefined for an unknown discovery URL", () => {
		const result = getOAuthProviderByDiscoveryUrl("https://unknown.example.com");
		expect(result).toBeUndefined();
	});

	// --- Tests for creation -------------------------------------------------

	it("should create a new oauth provider with provided values", () => {
		const newProvider = createOAuthProvider({
			name: "test_provider",
			discovery_url: "https://test.example.com/.well-known/openid-configuration",
			client_id: "test_client",
			client_secret_encrypted: Buffer.from("secret"),
			is_enabled: true
		});
		expect(newProvider).toBeDefined();
		expect(newProvider?.name).toBe("test_provider");
		expect(newProvider?.client_id).toBe("test_client");
		expect(newProvider?.is_enabled).toBe(true);
	});

	it("should do nothing and return the already existing provider", () => {
		const existingProvider = createOAuthProvider({
			name: "test_provider",
		});
		expect(existingProvider).toBeDefined();
		expect(existingProvider?.name).toBe("test_provider");
	});

	it("should create a new provider with default values when missing data", () => {
		const result = createOAuthProvider({});
		expect(result).toBeDefined();
		expect(result?.name).toBe("unknown_provider");
		expect(result?.is_enabled).toBe(true);
		expect(result?.discovery_url).toBeNull();
		expect(result?.client_id).toBeNull();
		expect(result?.client_secret_encrypted).toBeNull();
	});

	// --- Tests for listing --------------------------------------------------

	it("should list all providers sorted alphabetically by name", () => {
		const all = getAllOAuthProviders();
		const names = all.map(p => p.name);
		const isSorted = names.every((v, i, arr) => !i || arr[i - 1] <= v);
		expect(isSorted).toBe(true);
	});

});
