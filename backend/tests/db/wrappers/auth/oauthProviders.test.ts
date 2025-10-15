import { describe, it, expect, beforeAll } from "vitest";
import {
	getOauthProviderById,
	getOauthProviderByName,
	createOauthProvider,
	updateOauthProvider
} from "../../../../src/db/wrappers/auth/oauthProviders.js";

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
		expect(newProvider?.name).toBe("TestProvider");
		expect(newProvider?.client_id).toBe("test-client-id");
		createdProviderId = newProvider?.provider_id;
	});

	it("should create a new oauthProvider with default values when missing data", () => {
		const result = createOauthProvider({ name: "test" });
		expect(result).toBeDefined();
		expect(result?.name).toBe("test");
		expect(result?.is_enabled).toBe(1);
	});

	it("should store is_enabled as 0 when false on creation", () => {
		const result = createOauthProvider({ is_enabled: false });
		expect(result).toBeDefined();
		expect(result?.is_enabled).toBe(0);
	});

    it("must refuse the name because it is unique", () => {
		const result = createOauthProvider({});
		expect(result).toBeUndefined();
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
		expect(provider).toBeDefined();
		expect(provider?.provider_id).toBe(createdProviderId);
	});

	it("should return undefined if ID does not exist", () => {
		const result = getOauthProviderById(999999);
		expect(result).toBeUndefined();
	});

	it("should return an oauthProvider by name", () => {
		const provider = getOauthProviderByName("TestProvider");
		expect(provider).toBeDefined();
		expect(provider?.name).toBe("TestProvider");
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
		expect(updatedProvider?.is_enabled).toBe(0);
		expect(updatedProvider?.name).toBe("UpdatedName");
	});

	it("should update is_enabled correctly from true to false and back", () => {
		if (!createdProviderId) return;
		let updated = updateOauthProvider(createdProviderId, { is_enabled: true });
		expect(updated).toBe(true);
		let provider = getOauthProviderById(createdProviderId);
		expect(provider?.is_enabled).toBe(1);

		updated = updateOauthProvider(createdProviderId, { is_enabled: false });
		expect(updated).toBe(true);
		provider = getOauthProviderById(createdProviderId);
		expect(provider?.is_enabled).toBe(0);
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

	it("should return false when updating with only undefined/null fields", () => {
		if (!createdProviderId) return;
		const updated = updateOauthProvider(createdProviderId, { name: undefined, client_id: null });
		expect(updated).toBe(false);
	});
});
