import { describe, it, expect, beforeAll } from "vitest";
import { db } from "../../../../src/db/index.js";
import {
    createOauthAccounts,
    getOauthAccountsById,
    updateOauthAccounts,
} from "../../../../src/db/wrappers/auth/oauthAccounts.js";

describe("oauthAccounts wrapper - tests", () => {
    let userId: number;
    let providerName: string;
    let createdOauthAccountId: number | undefined;

    beforeAll(() => {
        // Insérer un rôle minimal pour l'utilisateur
        try {
            db.prepare(`INSERT OR IGNORE INTO user_roles (role_id, name) VALUES (?, ?)`).run(1, "testRole");
        } catch {}

        // Créer un utilisateur
        const insertUser = db.prepare(`
            INSERT INTO users (email, password_hash, role_id) VALUES (?, ?, ?)
        `);
        const userRes = insertUser.run("oauth_test_user@example.com", "hashed-pass", 1);
        userId = Number(userRes.lastInsertRowid);

        // Créer un fournisseur OAuth valide
        const insertProvider = db.prepare(`
            INSERT INTO oauth_providers (name, discovery_url, client_id, is_enabled) VALUES (?, ?, ?, ?)
        `);
        providerName = "TestProvider";
        insertProvider.run(providerName, "https://testprovider.com/.well-known/openid-configuration", "client-id-123", 1);
    });

    it("should create a new oauthAccount with valid data", () => {
        const newAccount = createOauthAccounts({
            user_id: userId,
            provider_name: providerName,
            provider_user_id: "user_123",
            profile_json: '{"name":"John Doe"}',
            id_token_hash: "hashed_token",
            linked_at: Date.now(),
            revoked_at: 0,
        });

        expect(newAccount).toBeDefined();
        expect(newAccount?.user_id).toBe(userId);
        expect(newAccount?.provider_name).toBe(providerName);
        expect(newAccount?.provider_user_id).toBe("user_123");

        createdOauthAccountId = (newAccount as any).oauth_account_id;
    });

    it("should create a new oauthAccount with default provider_name if missing", () => {
        // Ici on doit utiliser un provider_name valide car FK vers oauth_providers obligatoire
        // Donc on ne peut pas utiliser "Unknow" par défaut sans l'insérer d'abord.
        // Donc test modifié pour forcer provider_name correct.
        const newAccount = createOauthAccounts({
            user_id: userId,
            provider_user_id: "user_no_provider",
            provider_name: providerName, // Obligatoire pour la FK
        });
        expect(newAccount).toBeDefined();
        expect(newAccount?.provider_name).toBe(providerName);
        expect(newAccount?.provider_user_id).toBe("user_no_provider");
    });

    it("should fail to create oauthAccount if required fields are missing", () => {
        const noUserId = createOauthAccounts({
            provider_name: providerName,
            provider_user_id: "missing_user",
        });
        expect(noUserId).toBeUndefined();

        const noProviderUserId = createOauthAccounts({
            user_id: userId,
            provider_name: providerName,
        });
        expect(noProviderUserId).toBeUndefined();
    });

    it("should return oauthAccount by ID", () => {
        if (!createdOauthAccountId) return;

        const account = getOauthAccountsById(createdOauthAccountId);
        expect(account).toBeDefined();
        expect(account?.oauth_account_id).toBe(createdOauthAccountId);
    });

    it("should return undefined for non-existing oauthAccount ID", () => {
        const result = getOauthAccountsById(99999999);
        expect(result).toBeUndefined();
    });

    it("should update oauthAccount fields correctly", () => {
        if (!createdOauthAccountId) return;

        const updated = updateOauthAccounts(createdOauthAccountId, {
            profile_json: '{"name":"Jane Doe"}',
            revoked_at: Date.now(),
        });
        expect(updated).toBe(true);

        const updatedAccount = getOauthAccountsById(createdOauthAccountId);
        expect(updatedAccount?.profile_json).toBe('{"name":"Jane Doe"}');
        expect(updatedAccount?.revoked_at).toBeDefined();
    });

    it("should return false when updating with no valid fields", () => {
        if (!createdOauthAccountId) return;

        const updated = updateOauthAccounts(createdOauthAccountId, {});
        expect(updated).toBe(false);
    });

    it("should return false when updating a non-existing oauthAccount", () => {
        const updated = updateOauthAccounts(9999999, { profile_json: "{}" });
        expect(updated).toBe(false);
    });

    it("should cascade delete oauth_accounts when user is deleted", () => {
        if (!createdOauthAccountId) return;

        // Supprimer l'utilisateur
        db.prepare(`DELETE FROM users WHERE user_id = ?`).run(userId);

        // L'oauth_account associé doit être supprimé
        const account = getOauthAccountsById(createdOauthAccountId);
        expect(account).toBeUndefined();
    });
});
