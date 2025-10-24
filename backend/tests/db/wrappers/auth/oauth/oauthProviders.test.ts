import { describe, it, expect, beforeAll } from "vitest";
import {
	getOauthProviderById,
	getOauthProviderByName,
	createOauthProvider,
	updateOauthProvider,
	listOauthProviders
} from "../../../../../src/db/wrappers/auth/oauth/oauthProviders.js";
import { db } from "../../../../../src/db/index.js";

describe("oauthProviders wrapper", () => {
	let createdProviderId: number | undefined;

	it("should create a new oauthProvider with provided values", () => {
		const newProvider = createOauthProvider({
			name: "TestProvider",
			discovery_url: "https://testprovider.com/.well-known/openid-configuration",
			client_id: "test-client-id",
			client_secret_encrypted: Buffer.from("secret"),
			is_enabled: true,
		});
		expect(newProvider).toBeDefined();
        if (!newProvider)throw new Error("Expected an OAuth provider from newProvider, but got undefined.");
		expect(newProvider.name).toBe("TestProvider");
		expect(newProvider.client_id).toBe("test-client-id");
		createdProviderId = newProvider.provider_id;
        if (!createdProviderId)throw new Error("Expected an OAuth provider from createdProviderId, but got undefined.");
	});

	it("should create a new oauthProvider with default values when missing data", () => {
		const result = createOauthProvider({ name: "test" });
        if (!result)throw new Error("Expected an OAuth provider from result, but got undefined.");
		expect(result).toBeDefined();
		expect(result.name).toBe("test");
		expect(result.is_enabled).toBe(1);
	});

	it("should store is_enabled as 0 when false on creation", () => {
		const result = createOauthProvider({ is_enabled: false });
        if (!result)throw new Error("Expected an OAuth provider from result, but got undefined.");
		expect(result).toBeDefined();
		expect(result.is_enabled).toBe(0);
	});

	it("should return undefined when trying to create with duplicate unique name", () => {
		const first = createOauthProvider({ name: "UniqueProvider" });
		expect(first).toBeDefined();

		const second = createOauthProvider({ name: "UniqueProvider" });
		expect(second).toBeUndefined();
	});

	it("should return an oauthProvider by ID", () => {
		if (!createdProviderId) return;
		const provider = getOauthProviderById(createdProviderId);
        if (!provider)throw new Error("Expected an OAuth provider from provider, but got undefined.");
		expect(provider).toBeDefined();
		expect(provider.provider_id).toBe(createdProviderId);
	});

	it("should return undefined if ID does not exist", () => {
		const result = getOauthProviderById(999999);
		expect(result).toBeUndefined();
	});

	it("should return an oauthProvider by name", () => {
		const provider = getOauthProviderByName("TestProvider");
        if (!provider)throw new Error("Expected an OAuth provider from provider, but got undefined.");
		expect(provider).toBeDefined();
		expect(provider.name).toBe("TestProvider");
	});

	it("should return undefined for an unknown name", () => {
		const provider = getOauthProviderByName("UnknownProviderName");
		expect(provider).toBeUndefined();
	});

	it("should update an oauthProvider fields", () => {
		if (!createdProviderId) return;
		const updated = updateOauthProvider(createdProviderId, {
			is_enabled: false,
			name: "UpdatedName"
		});
		expect(updated).toBe(true);

		const updatedProvider = getOauthProviderById(createdProviderId);
        if (!updatedProvider)throw new Error("Expected an OAuth provider from updatedProvider, but got undefined.");
		expect(updatedProvider.is_enabled).toBe(0);
		expect(updatedProvider.name).toBe("UpdatedName");
	});

	it("should update is_enabled correctly from true to false and back", () => {
		if (!createdProviderId) return;
		let updated = updateOauthProvider(createdProviderId, { is_enabled: true });
		expect(updated).toBe(true);
		let provider = getOauthProviderById(createdProviderId);
        if (!provider)throw new Error("Expected an OAuth provider from provider, but got undefined.");
		expect(provider.is_enabled).toBe(1);

		updated = updateOauthProvider(createdProviderId, { is_enabled: false });
		expect(updated).toBe(true);
		provider = getOauthProviderById(createdProviderId);
        if (!provider)throw new Error("Expected an OAuth provider from provider, but got undefined.");
		expect(provider.is_enabled).toBe(0);
	});

	it("should return false when updating with no valid fields", () => {
		if (!createdProviderId) return;
		const updated = updateOauthProvider(createdProviderId, {});
		expect(updated).toBe(false);
	});

	it("should return false when updating a non-existing provider", () => {
		const updated = updateOauthProvider(999999, { is_enabled: true });
		expect(updated).toBe(false);
	});

	it("should store and retrieve client_secret_encrypted correctly", () => {
		const secret = Buffer.from("my-secret-value");
		const result = createOauthProvider({
			name: "SecretProvider",
			client_secret_encrypted: secret,
		});
		expect(result).toBeDefined();
        if (!result)throw new Error("Expected an OAuth provider from result, but got undefined.");
		expect(result.client_secret_encrypted.equals(secret)).toBe(true);

		const fetched = getOauthProviderById(result!.provider_id);
        if (!fetched)throw new Error("Expected an OAuth provider from result, but got undefined.");
		expect(fetched.client_secret_encrypted.equals(secret)).toBe(true);
	});

	it("should store and retrieve discovery_url and client_id", () => {
		const result = createOauthProvider({
			name: "DiscoveryProvider",
			discovery_url: "https://example.com/.well-known/openid-configuration",
			client_id: "client-123"
		});
		expect(result).toBeDefined();
        if (!result)throw new Error("Expected an OAuth provider from result, but got undefined.");
		expect(result.discovery_url).toBe("https://example.com/.well-known/openid-configuration");
		expect(result.client_id).toBe("client-123");

		const fetched = getOauthProviderById(result!.provider_id);
        if (!fetched)throw new Error("Expected an OAuth provider from fetched, but got undefined.");
		expect(fetched.discovery_url).toBe("https://example.com/.well-known/openid-configuration");
		expect(fetched.client_id).toBe("client-123");
	});

	it("should set created_at to a recent timestamp", () => {
		const before = Math.floor(Date.now() / 1000);
		const result = createOauthProvider({ name: "TimestampProvider" });
		const after = Math.floor(Date.now() / 1000);

		expect(result).toBeDefined();
		expect(result!.created_at).toBeGreaterThanOrEqual(before);
		expect(result!.created_at).toBeLessThanOrEqual(after);
	});

	it("should return false when updating with only undefined/null fields", () => {
		if (!createdProviderId) return;
		const updated = updateOauthProvider(createdProviderId, { name: undefined, client_id: undefined });
		expect(updated).toBe(false);
	});

	it("should return all providers with listOauthProviders()", () => {
		createOauthProvider({ name: "ListProvider1" });
		createOauthProvider({ name: "ListProvider2" });

		const all = listOauthProviders();
		const names = all.map(p => p.name);
		expect(names).toEqual(expect.arrayContaining(["ListProvider1", "ListProvider2"]));
	});

	it("should return only enabled providers when listOauthProviders(true) is used", () => {
		createOauthProvider({ name: "EnabledProvider", is_enabled: true });
		createOauthProvider({ name: "DisabledProvider", is_enabled: false });

		const enabledOnly = listOauthProviders(true);
		const names = enabledOnly.map(p => p.name);

		expect(names).toContain("EnabledProvider");
		expect(names).not.toContain("DisabledProvider");
	});

	it("should update multiple fields at once", () => {
		const provider = createOauthProvider({
			name: "MultiUpdateProvider",
			client_id: "old-client",
			is_enabled: true
		});
		expect(provider).toBeDefined();

		const success = updateOauthProvider(provider!.provider_id, {
			client_id: "new-client",
			is_enabled: false
		});
		expect(success).toBe(true);

		const updated = getOauthProviderById(provider!.provider_id);
        if (!updated)throw new Error("Expected an OAuth provider from updated, but got undefined.");
		expect(updated.client_id).toBe("new-client");
		expect(updated.is_enabled).toBe(0);
	});

	it("should return an empty array if no providers exist", () => {
		const all = listOauthProviders();
		expect(all).toBeInstanceOf(Array);
	});

	it("should return an empty array if db.prepare throws an error", () => {
		const originalPrepare = db.prepare;

		// @ts-expect-error
		db.prepare = vi.fn(() => { throw new Error("forced error"); });

		const result = listOauthProviders();

		expect(result).toEqual([]);
		db.prepare = originalPrepare;
	});
});
