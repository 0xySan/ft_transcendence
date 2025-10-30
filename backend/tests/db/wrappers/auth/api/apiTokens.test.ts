import { describe, it, expect, beforeAll } from "vitest";
import { v7 as uuidv7 } from "uuid";

import { db } from "../../../../../src/db/index.js";
import {
  createApiToken,
  getApiTokenById,
  updateApiToken,
  getTokenApiByHash,
  checkApiTokenValidity
} from "../../../../../src/db/wrappers/auth/api/apiTokens.js";
import {
  createApiClient,
} from "../../../../../src/db/wrappers/auth/api/apiClients.js";

describe("apiTokens wrapper - tests", () => {
  let userId: string;
  let appId: number;
  const now = Date.now();

  beforeAll(() => {
	userId = uuidv7();
    const insertUser = db.prepare(`
      INSERT INTO users (user_id, email, password_hash, role_id) VALUES (?, ?, ?, ?)
    `);
    insertUser.run(userId, "apitoken_user@example.com", "hashed", 1);

    const client = createApiClient({
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
    const token = createApiToken({
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
    const token = createApiToken({
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
    const created = createApiToken({
      app_id: appId,
      token_hash: "retrieval_token",
      scopes: "read",
      issued_at: now,
      expires_at: now + 50000,
      last_used_at: now,
    });

    const tokenId = (created as any).token_id;
    const retrieved = getApiTokenById(tokenId);

    if (!retrieved) throw new Error("Throw error (undefined)");
    expect(retrieved.token_hash).toBe("retrieval_token");
  });

  it("should update only one field without affecting others", () => {
    const created = createApiToken({
      app_id: appId,
      token_hash: "partial_update_token",
      scopes: "initial-scope",
      issued_at: now,
      expires_at: now + 50000,
      last_used_at: now,
      revoked: false,
    });

    if (!created) throw new Error("Throw error (undefined)");
    const tokenId = created.token_id;

    const updated = updateApiToken(tokenId, {
      scopes: "updated-scope",
    });

    expect(updated).toBe(true);

    const result = getApiTokenById(tokenId);
    expect(result?.scopes).toBe("updated-scope");
    expect(result?.token_hash).toBe("partial_update_token");
  });

  it("should return undefined for unknown token ID", () => {
    const result = getApiTokenById(999999);
    expect(result).toBeUndefined();
  });

  it("should retrieve token by its token_hash", () => {
    const tokenHash = "hash_lookup_token";

    const created = createApiToken({
      app_id: appId,
      token_hash: tokenHash,
      scopes: "read write",
      issued_at: now,
      expires_at: now + 60000,
      last_used_at: now,
      revoked: false,
    });

    const token = getTokenApiByHash(tokenHash);
    if (!token) throw new Error("Throw error (undefined)");

    expect(token.token_hash).toBe(tokenHash);
  });

  it("should return undefined when token_hash does not exist", () => {
    const token = getTokenApiByHash("non_existing_hash");
    expect(token).toBeUndefined();
  });

  it("should validate a valid, not revoked, non-expired token", () => {
    const tokenHash = "valid_token_hash";

    createApiToken({
      app_id: appId,
      token_hash: tokenHash,
      scopes: "read",
      issued_at: now,
      expires_at: Math.floor(Date.now() / 1000) + 3600, // expires in 1 hour
      last_used_at: now,
      revoked: false,
    });

    const isValid = checkApiTokenValidity(tokenHash);
    expect(isValid).toBe(true);
  });

  it("should invalidate a revoked token", () => {
    const tokenHash = "revoked_token_hash";

    createApiToken({
      app_id: appId,
      token_hash: tokenHash,
      scopes: "read",
      issued_at: now,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      last_used_at: now,
      revoked: true,
    });

    const isValid = checkApiTokenValidity(tokenHash);
    expect(isValid).toBe(false);
  });

  it("should invalidate an expired token", () => {
    const tokenHash = "expired_token_hash";

    createApiToken({
      app_id: appId,
      token_hash: tokenHash,
      scopes: "read",
      issued_at: now,
      expires_at: Math.floor(Date.now() / 1000) - 10, // expired 10 seconds ago
      last_used_at: now,
      revoked: false,
    });

    const isValid = checkApiTokenValidity(tokenHash);
    expect(isValid).toBe(false);
  });

  it("should invalidate a non-existing token", () => {
    const isValid = checkApiTokenValidity("non_existing_token");
    expect(isValid).toBe(false);
  });

  it("should update token fields including revoked = true", () => {
    const created = createApiToken({
      app_id: appId,
      token_hash: "update_token",
      scopes: "read",
      issued_at: now,
      expires_at: now + 100000,
      last_used_at: now,
      revoked: false,
    });

    const tokenId = (created as any).token_id;
    const updated = updateApiToken(tokenId, {
      last_used_at: now + 5000,
      revoked: true,
    });

    expect(updated).toBe(true);

    const updatedToken = getApiTokenById(tokenId);
    if (!updatedToken) throw new Error("Throw error (undefined)");
    expect(updatedToken.last_used_at).toBe(now + 5000);
    expect(updatedToken.revoked).toBe(1);
  });

  it("should update token with revoked = false", () => {
    const created = createApiToken({
      app_id: appId,
      token_hash: "update_false_token",
      scopes: "admin",
      issued_at: now,
      expires_at: now + 100000,
      last_used_at: now,
      revoked: true,
    });

    const tokenId = (created as any).token_id;
    const updated = updateApiToken(tokenId, {
      revoked: false,
    });

    expect(updated).toBe(true);

    const token = getApiTokenById(tokenId);
    if (!token) throw new Error("Throw error (undefined)");
    expect(token.revoked).toBe(0);
  });

  it("should return false when no valid fields are provided for update", () => {
    const created = createApiToken({
      app_id: appId,
      token_hash: "no_update_fields",
      scopes: "none",
      issued_at: now,
      expires_at: now + 1000,
      last_used_at: now,
    });

    const tokenId = (created as any).token_id;
    const updated = updateApiToken(tokenId, {});
    expect(updated).toBe(false);
  });

  it("should return false when updating non-existing token", () => {
    const updated = updateApiToken(9999999, { revoked: true });
    expect(updated).toBe(false);
  });

  it("should cascade delete token when api_client is deleted", () => {
    const created = createApiToken({
      app_id: appId,
      token_hash: "to_be_deleted",
      scopes: "delete",
      issued_at: now,
      expires_at: now + 10000,
      last_used_at: now,
    });

    const tokenId = (created as any).token_id;

    db.prepare(`DELETE FROM api_clients WHERE app_id = ?`).run(appId);

    const token = getApiTokenById(tokenId);
    expect(token).toBeUndefined();
  });
});
