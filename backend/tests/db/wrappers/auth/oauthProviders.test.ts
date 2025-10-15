import { describe, it, expect, beforeAll } from "vitest";
import {
	getOauthProvidersById,
	getOauthProvidersByName,
	createOauthProviders,
	updateOauthProviders
} from "../../../../src/db/wrappers/auth/oauthProviders.js";

describe("oauthProviders wrapper", () => {
	let createdProviderId: number | undefined;

	it("should create a new oauthProvider with provided values", () => {
		const newProvider = createOauthProviders({
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
		const result = createOauthProviders({ name: "test" });
		expect(result).toBeDefined();
		expect(result?.name).toBe("test");
		expect(result?.is_enabled).toBe(1);
	});

	it("should store is_enabled as 0 when false on creation", () => {
		const result = createOauthProviders({ is_enabled: false });
		expect(result).toBeDefined();
		expect(result?.is_enabled).toBe(0);
	});

    it("must refuse the name because it is unique", () => {
		const result = createOauthProviders({});
		expect(result).toBeUndefined();
	});

	it("should return undefined when trying to create with duplicate unique name", () => {
		const first = createOauthProviders({ name: "UniqueProvider" });
		expect(first).toBeDefined();

		const second = createOauthProviders({ name: "UniqueProvider" });
		expect(second).toBeUndefined();
	});

	it("should return an oauthProvider by ID", () => {
		if (!createdProviderId) return;
		const provider = getOauthProvidersById(createdProviderId);
		expect(provider).toBeDefined();
		expect(provider?.provider_id).toBe(createdProviderId);
	});

	it("should return undefined if ID does not exist", () => {
		const result = getOauthProvidersById(999999);
		expect(result).toBeUndefined();
	});

	it("should return an oauthProvider by name", () => {
		const provider = getOauthProvidersByName("TestProvider");
		expect(provider).toBeDefined();
		expect(provider?.name).toBe("TestProvider");
	});

	it("should return undefined for an unknown name", () => {
		const provider = getOauthProvidersByName("UnknownProviderName");
		expect(provider).toBeUndefined();
	});

	it("should update an oauthProvider fields", () => {
		if (!createdProviderId) return;
		const updated = updateOauthProviders(createdProviderId, {
			is_enabled: false,
			name: "UpdatedName"
		});
		expect(updated).toBe(true);

		const updatedProvider = getOauthProvidersById(createdProviderId);
		expect(updatedProvider?.is_enabled).toBe(0);
		expect(updatedProvider?.name).toBe("UpdatedName");
	});

	it("should update is_enabled correctly from true to false and back", () => {
		if (!createdProviderId) return;
		let updated = updateOauthProviders(createdProviderId, { is_enabled: true });
		expect(updated).toBe(true);
		let provider = getOauthProvidersById(createdProviderId);
		expect(provider?.is_enabled).toBe(1);

		updated = updateOauthProviders(createdProviderId, { is_enabled: false });
		expect(updated).toBe(true);
		provider = getOauthProvidersById(createdProviderId);
		expect(provider?.is_enabled).toBe(0);
	});

	it("should return false when updating with no valid fields", () => {
		if (!createdProviderId) return;
		const updated = updateOauthProviders(createdProviderId, {});
		expect(updated).toBe(false);
	});

	it("should return false when updating a non-existing provider", () => {
		const updated = updateOauthProviders(999999, { is_enabled: true });
		expect(updated).toBe(false);
	});

	it("should return false when updating with only undefined/null fields", () => {
		if (!createdProviderId) return;
		const updated = updateOauthProviders(createdProviderId, { name: undefined, client_id: null });
		expect(updated).toBe(false);
	});
});