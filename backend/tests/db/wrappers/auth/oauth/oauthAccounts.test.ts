import { describe, it, expect, beforeAll } from "vitest";
import { v7 as uuidv7 } from "uuid";

import { db } from "../../../../../src/db/index.js";
import {
    createOauthAccount,
    getOauthAccountById,
    updateOauthAccount,
    getOauthAccountByProviderAndUserId,
    getOauthAccountsByUserId
} from "../../../../../src/db/wrappers/auth/oauth/oauthAccounts.js";

describe("oauthAccount wrapper - tests", () => {
    let userId: string;
    let providerName: string;
    let createdOauthAccountId: number | undefined;

    beforeAll(() => {
		userId = uuidv7();
        const insertUser = db.prepare(`
            INSERT INTO users (user_id, email, password_hash, role_id) VALUES (?, ?, ?, ?)
        `);
        insertUser.run(userId, "oauth_test_user@example.com", "hashed-pass", 1);

        const insertProvider = db.prepare(`
            INSERT INTO oauth_providers (name, discovery_url, client_id, is_enabled) VALUES (?, ?, ?, ?)
        `);
        providerName = "TestProvider";
        insertProvider.run(providerName, "https://testprovider.com/.well-known/openid-configuration", "client-id-123", 1);

        insertProvider.run("Unknow", "", "", 0);
    });

    it("should create a new oauthAccount with default provider_name 'Unknow' if missing", () => {
        const newAccount = createOauthAccount({
            user_id: userId,
            provider_user_id: "user_default_provider",
        });
        expect(newAccount).toBeDefined();
        if (!newAccount)throw new Error("Expected an OAuth account from createOauthAccount(), but got undefined.");
        expect(newAccount.provider_name).toBe("Unknow");
        expect(newAccount.provider_user_id).toBe("user_default_provider");
    });

    it("should create a new oauthAccount with valid data", () => {
        const newAccount = createOauthAccount({
            user_id: userId,
            provider_name: providerName,
            provider_user_id: "user_123",
            profile_json: '{"name":"John Doe"}',
            id_token_hash: "hashed_token",
            linked_at: Date.now(),
            revoked_at: 0,
        });

        expect(newAccount).toBeDefined();
        if (!newAccount) throw new Error("Expected an OAuth account from createOauthAccount(), but got undefined.");
        expect(newAccount.user_id).toBe(userId);
        expect(newAccount.provider_name).toBe(providerName);
        expect(newAccount.provider_user_id).toBe("user_123");

        createdOauthAccountId = (newAccount as any).oauth_account_id;
    });

    it("should return all oauthAccounts for a specific user", () => {
        createOauthAccount({
            user_id: userId,
            provider_name: providerName,
            provider_user_id: "userA"
        });

        createOauthAccount({
            user_id: userId,
            provider_name: providerName,
            provider_user_id: "userB"
        });

        const accounts = getOauthAccountsByUserId(userId);
        console.log("DEBUG: len accounts = " + accounts)
        expect(Array.isArray(accounts)).toBe(true);
        expect(accounts.length).toBeGreaterThanOrEqual(2);

        const userIds = accounts.map(acc => acc.user_id);
        expect(userIds.every(id => id === userId)).toBe(true);
    });

    it("should create a new oauthAccount with default provider_name if missing", () => {
        const newAccount = createOauthAccount({
            user_id: userId,
            provider_user_id: "user_no_provider",
            provider_name: providerName,
        });
        expect(newAccount).toBeDefined();
        if (!newAccount) throw new Error("Expected an OAuth account from createOauthAccount(), but got undefined.");
        expect(newAccount.provider_name).toBe(providerName);
        expect(newAccount.provider_user_id).toBe("user_no_provider");
    });

    it("should return oauthAccount by provider_name and provider_user_id", () => {
        const provider_user_id = "unique_provider_user";

        createOauthAccount({
            user_id: userId,
            provider_name: providerName,
            provider_user_id: provider_user_id
        });

        const found = getOauthAccountByProviderAndUserId(providerName, provider_user_id);

        expect(found).toBeDefined();

        if (!found)throw new Error("Expected to find an oauthAccount but got undefined");
        expect(found.provider_user_id).toBe(provider_user_id);
        expect(found.provider_name).toBe(providerName);
    });


    it("should return undefined for unknown provider/user combination", () => {
        const found = getOauthAccountByProviderAndUserId("non-existent-provider", "non-existent-user");
        expect(found).toBeUndefined();
    });

    it("should return undefined if user_id is not a number", () => {
        const result = createOauthAccount({
            user_id: "not-a-number",
            provider_name: providerName,
            provider_user_id: "invalid_type_test"
        });
        expect(result).toBeUndefined();
    });

    it("should store and retrieve complex JSON in profile_json", () => {
        const complexProfile = JSON.stringify({
            name: "Alice",
            email: "alice@example.com",
            picture: "https://cdn.example.com/avatar.png",
            metadata: {
                lastLogin: Date.now(),
                roles: ["admin", "editor"]
            }
        });

        createOauthAccount({
            user_id: userId,
            provider_name: providerName,
            provider_user_id: "json_test_user",
            profile_json: complexProfile
        });

        const found = getOauthAccountByProviderAndUserId(providerName, "json_test_user");
        if (!found)throw new Error("Expected an OAuth account from getOauthAccountByProviderAndUserId, but got undefined.");
        expect(found.profile_json).toBe(complexProfile);
    });

    it("should update all fields of an oauthAccount", () => {
        const account = createOauthAccount({
            user_id: userId,
            provider_name: providerName,
            provider_user_id: "update_all_test",
            profile_json: "{}",
            id_token_hash: "hash",
            linked_at: 111111,
            revoked_at: 0
        });

        const accountId = (account as any).oauth_account_id;

        const updated = updateOauthAccount(accountId, {
            profile_json: '{"updated":true}',
            id_token_hash: "new_hash",
            linked_at: 222222,
            revoked_at: 333333
        });

        expect(updated).toBe(true);

        const found = getOauthAccountById(accountId);
        if (!found)throw new Error("Expected an OAuth account from gaccountId, but got undefined.");
        expect(found.profile_json).toBe('{"updated":true}');
        expect(found.id_token_hash).toBe("new_hash");
        expect(found.linked_at).toBe(222222);
        expect(found.revoked_at).toBe(333333);
    });

    it("should fail to create oauthAccount if required fields are missing", () => {
        const noUserId = createOauthAccount({
            provider_name: providerName,
            provider_user_id: "missing_user",
        });
        expect(noUserId).toBeUndefined();

        const noProviderUserId = createOauthAccount({
            user_id: userId,
            provider_name: providerName,
        });
        expect(noProviderUserId).toBeUndefined();
    });

    it("should return oauthAccount by ID", () => {
        if (!createdOauthAccountId) return;

        const account = getOauthAccountById(createdOauthAccountId);
        expect(account).toBeDefined();
    });

    it("should return undefined for non-existing oauthAccount ID", () => {
        const result = getOauthAccountById(99999999);
        expect(result).toBeUndefined();
    });

    it("should update oauthAccount fields correctly", () => {
        if (!createdOauthAccountId) return;

        const updated = updateOauthAccount(createdOauthAccountId, {
            profile_json: '{"name":"Jane Doe"}',
            revoked_at: Date.now(),
        });
        expect(updated).toBe(true);

        const updatedAccount = getOauthAccountById(createdOauthAccountId);
        if (!updatedAccount)throw new Error("Expected an OAuth account from getOauthAccountById(), but got undefined.");
        expect(updatedAccount.profile_json).toBe('{"name":"Jane Doe"}');
        expect(updatedAccount.revoked_at).toBeDefined();
    });

    it("should return false when updating with no valid fields", () => {
        if (!createdOauthAccountId) return;

        const updated = updateOauthAccount(createdOauthAccountId, {});
        expect(updated).toBe(false);
    });

    it("should return false when updating a non-existing oauthAccount", () => {
        const updated = updateOauthAccount(9999999, { profile_json: "{}" });
        expect(updated).toBe(false);
    });

    it("should cascade delete oauth_accounts when user is deleted", () => {
        if (!createdOauthAccountId) return;

        db.prepare(`DELETE FROM users WHERE user_id = ?`).run(userId);

        const account = getOauthAccountById(createdOauthAccountId);
        expect(account).toBeUndefined();
    });

    it("should return undefined if db.prepare throws an error in getOauthAccountByProviderAndUserId", () => {
        const originalPrepare = db.prepare;

        // @ts-expect-error
        db.prepare = vi.fn(() => { throw new Error("forced error"); });

        const result = getOauthAccountByProviderAndUserId("any-provider", "any-user");

        expect(result).toBeUndefined();
        db.prepare = originalPrepare;
    });
});
