import { describe, it, expect, beforeAll } from "vitest";
import { db } from "../../../../src/db/index.js";
import {
  createApiTokens,
  getApiTokensById,
  updateApiTokens,
} from "../../../../src/db/wrappers/auth/apiTokens.js";
import {
  createApiClients,
} from "../../../../src/db/wrappers/auth/apiClients.js";

describe("apiTokens wrapper - tests", () => {
  let userId: number;
  let appId: number;
  const now = Date.now();

  beforeAll(() => {
    const insertUser = db.prepare(`
      INSERT INTO users (email, password_hash, role_id) VALUES (?, ?, ?)
    `);
    const resUser = insertUser.run("apitoken_user@example.com", "hashed", 1);
    userId = Number(resUser.lastInsertRowid);

    const client = createApiClients({
      client_id: "token-client-1",
      owner_id: userId,
      name: "Token Client App",
      client_secret_encrypted: "super-secret",
      redirect_url: "https://example.com/redirect",
      scopes: "read write",
      is_confidential: true,
      created_at: now,
      updated_at: now,
      secret_expiration: now + 100000,
    });

    if (!client) throw new Error("Failed to create api_client for token tests");
    appId = (client as any).app_id;
  });

  it("should create a new API token with valid data", () => {
    const token = createApiTokens({
      app_id: appId,
      token_hash: "hashed_token_123",
      scopes: "read",
      issued_at: now,
      expires_at: now + 100000,
      last_used_at: now,
      revoked: false,
    });

    if (!token) throw new Error("Throw error (undefined)");
    expect(token.revoked).toBe(0);
  });

  it("should default 'revoked' to false when not provided", () => {
    const token = createApiTokens({
      app_id: appId,
      token_hash: "no_revoked_token",
      scopes: "write",
      issued_at: now,
      expires_at: now + 200000,
      last_used_at: now,
    });

    if (!token) throw new Error("Throw error (undefined)");
    expect(token.revoked).toBe(0);
  });

  it("should retrieve token by ID", () => {
    const created = createApiTokens({
      app_id: appId,
      token_hash: "retrieval_token",
      scopes: "read",
      issued_at: now,
      expires_at: now + 50000,
      last_used_at: now,
    });

    const tokenId = (created as any).token_id;
    const retrieved = getApiTokensById(tokenId);

    if (!retrieved) throw new Error("Throw error (undefined)");
    expect(retrieved.token_hash).toBe("retrieval_token");
  });

  it("should update only one field without affecting others", () => {
    const created = createApiTokens({
      app_id: appId,
      token_hash: "partial_update_token",
      scopes: "initial-scope",
      issued_at: now,
      expires_at: now + 50000,
      last_used_at: now,
      revoked: false,
    });

    const tokenId = (created as any).token_id;

    const updated = updateApiTokens(tokenId, {
      scopes: "updated-scope",
    });

    expect(updated).toBe(true);

    const result = getApiTokensById(tokenId);
    expect(result?.scopes).toBe("updated-scope");
    expect(result?.token_hash).toBe("partial_update_token");
  });

  it("should return undefined for unknown token ID", () => {
    const result = getApiTokensById(999999);
    expect(result).toBeUndefined();
  });

  it("should update token fields including revoked = true", () => {
    const created = createApiTokens({
      app_id: appId,
      token_hash: "update_token",
      scopes: "read",
      issued_at: now,
      expires_at: now + 100000,
      last_used_at: now,
      revoked: false,
    });

    const tokenId = (created as any).token_id;
    const updated = updateApiTokens(tokenId, {
      last_used_at: now + 5000,
      revoked: true,
    });

    expect(updated).toBe(true);

    const updatedToken = getApiTokensById(tokenId);
    if (!updatedToken) throw new Error("Throw error (undefined)");
    expect(updatedToken.last_used_at).toBe(now + 5000);
    expect(updatedToken.revoked).toBe(1);
  });

  it("should update token with revoked = false", () => {
    const created = createApiTokens({
      app_id: appId,
      token_hash: "update_false_token",
      scopes: "admin",
      issued_at: now,
      expires_at: now + 100000,
      last_used_at: now,
      revoked: true,
    });

    const tokenId = (created as any).token_id;
    const updated = updateApiTokens(tokenId, {
      revoked: false,
    });

    expect(updated).toBe(true);

    const token = getApiTokensById(tokenId);
    if (!token) throw new Error("Throw error (undefined)");
    expect(token.revoked).toBe(0);
  });

  it("should return false when no valid fields are provided for update", () => {
    const created = createApiTokens({
      app_id: appId,
      token_hash: "no_update_fields",
      scopes: "none",
      issued_at: now,
      expires_at: now + 1000,
      last_used_at: now,
    });

    const tokenId = (created as any).token_id;
    const updated = updateApiTokens(tokenId, {});
    expect(updated).toBe(false);
  });

  it("should return false when updating non-existing token", () => {
    const updated = updateApiTokens(9999999, { revoked: true });
    expect(updated).toBe(false);
  });

  it("should cascade delete token when api_client is deleted", () => {
    const created = createApiTokens({
      app_id: appId,
      token_hash: "to_be_deleted",
      scopes: "delete",
      issued_at: now,
      expires_at: now + 10000,
      last_used_at: now,
    });

    const tokenId = (created as any).token_id;

    db.prepare(`DELETE FROM api_clients WHERE app_id = ?`).run(appId);

    const token = getApiTokensById(tokenId);
    expect(token).toBeUndefined();
  });
});
