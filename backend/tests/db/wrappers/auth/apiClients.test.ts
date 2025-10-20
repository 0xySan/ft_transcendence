import { describe, it, expect, beforeAll } from "vitest";
import { db } from "../../../../src/db/index.js";
import {
    createApiClients,
    getApiClientsById,
    updateApiClients,
    getApiClientsByClientId,
    listApiClients
} from "../../../../src/db/wrappers/auth/apiClients.js";

describe("apiClients wrapper - tests", () => {
    let userId: number;
    let createdClient: any;

    beforeAll(() => {
        const insertUser = db.prepare(`
            INSERT INTO users (email, password_hash, role_id) VALUES (?, ?, ?)
        `);
        const res = insertUser.run("test_client_user@example.com", "hashed-password", 1);
        userId = Number(res.lastInsertRowid);
    });

    it("should create a new api client with valid data", () => {
        const now = Date.now();
        const client = createApiClients({
            client_id: "test-client-id",
            owner_id: userId,
            name: "Test API",
            client_secret_encrypted: "encrypted_secret_value",
            redirect_url: "https://example.com/callback",
            scopes: "read,write",
            is_confidential: true,
            created_at: now,
            updated_at: now,
            secret_expiration: now + 1000 * 60 * 60 * 24 * 30,
        });

        if (!client) throw new Error("Throw error (undefined)");

        createdClient = client;

        expect(client.client_id).toBe("test-client-id");
        expect(client.owner_id).toBe(userId);
    });

    it("should return the api client by ID", () => {
        const found = getApiClientsById((createdClient as any).app_id);
        if (!found) throw new Error("Throw error (undefined)");
        expect(found.client_id).toBe("test-client-id");
        expect(found.owner_id).toBe(userId);
    });

    it("should update specific fields of the api client", () => {
        const updated = updateApiClients((createdClient as any).app_id, {
            name: "Updated API Client Name",
            scopes: "read"
        });
        expect(updated).toBe(true);

        const found = getApiClientsById((createdClient as any).app_id);
        if (!found) throw new Error("Throw error (undefined)");
        expect(found.name).toBe("Updated API Client Name");
        expect(found.scopes).toBe("read");
    });

    it("should return false when no valid fields are provided for update", () => {
        const updated = updateApiClients((createdClient as any).app_id, {});
        expect(updated).toBe(false);
    });

    it("should correctly store and retrieve is_confidential = true", () => {
        const now = Date.now();
        const client = createApiClients({
            client_id: "confidential-true-client",
            owner_id: userId,
            client_secret_encrypted: "secret_true",
            created_at: now,
            updated_at: now,
            secret_expiration: now + 3600 * 1000,
            is_confidential: true
        });

        if (!client) throw new Error("Throw error (undefined)");

        const found = getApiClientsById((client as any).app_id);
        if (!found) throw new Error("Throw error (undefined)");
        expect(found.is_confidential).toBe(1);
    });

        it("should retrieve api client by client_id", () => {
        const now = Date.now();

        const client = createApiClients({
            client_id: "lookup-client-id",
            owner_id: userId,
            client_secret_encrypted: "lookup_secret",
            redirect_url: "https://lookup.example.com",
            scopes: "lookup",
            created_at: now,
            updated_at: now,
            secret_expiration: now + 3600 * 1000,
            is_confidential: true
        });

        expect(client).toBeDefined();

        const found = getApiClientsByClientId("lookup-client-id");
        if (!found) throw new Error("Throw error (undefined)");
        expect(found.client_id).toBe("lookup-client-id");
        expect(found.owner_id).toBe(userId);
    });

    it("should return undefined for unknown client_id", () => {
        const found = getApiClientsByClientId("non-existent-client-id");
        expect(found).toBeUndefined();
    });

    it("should return a list of api clients", () => {
        const clients = listApiClients();
        expect(Array.isArray(clients)).toBe(true);
        expect(clients.length).toBeGreaterThan(0);
        expect(clients[0]).toHaveProperty("client_id");
        expect(clients[0]).toHaveProperty("owner_id");
    });

    it("should return false when updating non-existing api client", () => {
        const updated = updateApiClients(9999999, { name: "Non-existent" });
        expect(updated).toBe(false);
    });

    it("should correctly update is_confidential to true", () => {
        const now = Date.now();
        const client = createApiClients({
            client_id: "conf-update-true",
            owner_id: userId,
            client_secret_encrypted: "secret_update_true",
            created_at: now,
            updated_at: now,
            secret_expiration: now + 1000 * 60 * 60 * 24,
            is_confidential: false
        });

        if (!client) throw new Error("Throw error (undefined)");
        const app_id = (client as any).app_id;

        const updated = updateApiClients(app_id, { is_confidential: true });
        expect(updated).toBe(true);

        const found = getApiClientsById(app_id);
        if (!found) throw new Error("Throw error (undefined)");
        expect(found.is_confidential).toBe(1);
    });

    it("should correctly update is_confidential to false", () => {
        const now = Date.now();
        const client = createApiClients({
            client_id: "conf-update-false",
            owner_id: userId,
            client_secret_encrypted: "secret_update_false",
            created_at: now,
            updated_at: now,
            secret_expiration: now + 1000 * 60 * 60 * 24,
            is_confidential: true
        });

        if (!client) throw new Error("Throw error (undefined)");
        const app_id = (client as any).app_id;

        const updated = updateApiClients(app_id, { is_confidential: false });
        expect(updated).toBe(true);

        const found = getApiClientsById(app_id);
        if (!found) throw new Error("Throw error (undefined)");
        expect(found.is_confidential).toBe(0);
    });

    it("should default is_confidential to true when not provided", () => {
        const now = Date.now();

        const client = createApiClients({
            client_id: "default-confidential-client",
            owner_id: userId,
            client_secret_encrypted: "secret",
            created_at: now,
            updated_at: now,
            secret_expiration: now + 1000 * 60 * 60 * 24
        });

        if (!client) throw new Error("Throw error (undefined)");
        const app_id = (client as any).app_id;
        const found = getApiClientsById(app_id);

        if (!found) throw new Error("Throw error (undefined)");
        expect(found.is_confidential).toBe(1);
    });

    it("should cascade delete api client when user is deleted", () => {
        db.prepare(`DELETE FROM users WHERE user_id = ?`).run(userId);
        const found = getApiClientsById((createdClient as any).app_id);
        expect(found).toBeUndefined();
    });
});
