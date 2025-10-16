/**
 * @file oauthTokens.test.ts
 * @description Tests for the oauth_tokens table exercised via the wrappers.
 */

import { describe, it, expect, beforeAll, beforeEach } from "vitest";

import {
	createOauthToken,
	getOauthTokenById,
	getOauthTokenByAccountId,
	getOauthTokenByAccessTokenHash,
	updateOauthToken,
	listOauthTokensByAccountId,
	isTokenValid
} from "../../../../src/db/wrappers/auth/oauthTokens.js";

import { db } from "../../../../src/db/index.js";

describe("OauthTokens wrapper", () => {
	// --- Prepare an oauth_account before the test suite -----------------------
	let oauthAccountId: number;

	beforeAll(() => {
		const insertUserStmt = db.prepare(
			`INSERT INTO users (email, password_hash, role_id) VALUES (?, ?, ?)`
		);
		const u = insertUserStmt.run("OauthTokenUsers@test.com", "hashed-pass", 1);
		const userId = Number(u.lastInsertRowid);

		const insertProviderStmt = db.prepare(
			`INSERT INTO oauth_providers (name, discovery_url, client_id, is_enabled) VALUES (?, ?, ?, ?)`
		);
		const p = insertProviderStmt.run("TestProvider", "https://testprovider.com/.well-known/openid-configuration", "client-id-123", 1);
		const providerName = "TestProvider";

		const insertAccountStmt = db.prepare(
			`INSERT INTO oauth_accounts (user_id, provider_name, provider_user_id, profile_json, id_token_hash, linked_at, revoked_at) 
			 VALUES (?, ?, ?, ?, ?, ?, ?)`
		);
		const a = insertAccountStmt.run(userId, providerName, "provider_user_123", '{"name":"John Doe"}', "hashed_id_token", Math.floor(Date.now() / 1000), 0);
		oauthAccountId = Number(a.lastInsertRowid);
	});

	// --- Isolation: clear oauth_tokens before each test -------
	beforeEach(() => {
		db.prepare("DELETE FROM oauth_tokens").run();
	});

	// --- Tests ----------------------------------------------------------
	it("should create a new OauthToken with valid data", () => {
		const newToken = createOauthToken({
			oauth_account_id: oauthAccountId,
			access_token_hash: "access_hash_123",
			refresh_token_hash: "refresh_hash_123",
			scopes: "read write",
			token_type: "Bearer",
			issued_at: Math.floor(Date.now() / 1000),
			expires_at: Math.floor(Date.now() / 1000) + 3600,
			revoked: false
		});

		expect(newToken).toBeDefined();
		console.log("DEBUG: account_id = " + newToken?.oauth_account_id + " second = " + oauthAccountId);
		expect(newToken?.oauth_account_id).toBe(oauthAccountId);
		expect(newToken?.access_token_hash).toBe("access_hash_123");
	});

	it("should retrieve an OAuth token by its ID", () => {
		const token = createOauthToken({
			oauth_account_id: oauthAccountId,
			access_token_hash: "hash_by_id",
		});

		const fetched = getOauthTokenById((token as any).oauth_token_id);
		expect(fetched).toBeDefined();
		expect(fetched?.access_token_hash).toBe("hash_by_id");
	});

	it("should retrieve token by access_token_hash", () => {
		createOauthToken({
			oauth_account_id: oauthAccountId,
			access_token_hash: "find_me_hash"
		});

		const result = getOauthTokenByAccessTokenHash("find_me_hash");
		expect(result).toBeDefined();
		expect(result?.access_token_hash).toBe("find_me_hash");
	});

	it("should return undefined if access_token_hash not found", () => {
		const result = getOauthTokenByAccessTokenHash("non_existent_hash");
		expect(result).toBeUndefined();
	});

	it("should return false if trying to update with no valid fields", () => {
		const token = createOauthToken({
			oauth_account_id: oauthAccountId,
			access_token_hash: "no_update"
		});

		const tokenId = (token as any).oauth_token_id;
		const result = updateOauthToken(tokenId, {});
		expect(result).toBe(false);
	});

	it("should list all tokens for a given account ID", () => {
		createOauthToken({
			oauth_account_id: oauthAccountId,
			access_token_hash: "token1"
		});
		createOauthToken({
			oauth_account_id: oauthAccountId,
			access_token_hash: "token2"
		});

		const tokens = listOauthTokensByAccountId(oauthAccountId);
		expect(Array.isArray(tokens)).toBe(true);
		expect(tokens.length).toBeGreaterThanOrEqual(2);
	});

	it("should return true if token is valid (not revoked, not expired)", () => {
		const now = Math.floor(Date.now() / 1000);
		const token = createOauthToken({
			oauth_account_id: oauthAccountId,
			access_token_hash: "valid_token",
			issued_at: now,
			expires_at: now + 3600,
			revoked: false
		});

		const tokenId = (token as any).oauth_token_id;
		expect(isTokenValid(tokenId)).toBe(true);
	});

	it("should return false if token is revoked", () => {
		const now = Math.floor(Date.now() / 1000);
		const token = createOauthToken({
			oauth_account_id: oauthAccountId,
			access_token_hash: "revoked_token",
			issued_at: now,
			expires_at: now + 3600,
			revoked: true
		});

		const tokenId = (token as any).oauth_token_id;
		expect(isTokenValid(tokenId)).toBe(false);
	});

	it("should return false if token is expired", () => {
		const now = Math.floor(Date.now() / 1000);
		const token = createOauthToken({
			oauth_account_id: oauthAccountId,
			access_token_hash: "expired_token",
			issued_at: now - 7200,
			expires_at: now - 3600,
			revoked: false
		});

		const tokenId = (token as any).oauth_token_id;
		expect(isTokenValid(tokenId)).toBe(false);
	});

	it("should return false if token does not exist", () => {
		expect(isTokenValid(999999)).toBe(false);
	});

	it("should default expires_at to 1 hour after issued_at if not provided", () => {
		const now = Math.floor(Date.now() / 1000);
		const token = createOauthToken({
			oauth_account_id: oauthAccountId,
			access_token_hash: "default_expiry",
			issued_at: now
		});

		expect(token?.expires_at).toBe(now + 3600);
	});

	it("should return all OAuth tokens for a given account ID", () => {
		createOauthToken({
			oauth_account_id: oauthAccountId,
			access_token_hash: "account_token_1",
		});
		createOauthToken({
			oauth_account_id: oauthAccountId,
			access_token_hash: "account_token_2",
		});
		createOauthToken({
			oauth_account_id: oauthAccountId + 1,
			access_token_hash: "other_account_token",
		});

		const tokens = getOauthTokenByAccountId(oauthAccountId);
		expect(Array.isArray(tokens)).toBe(true);
		expect(tokens.length).toBeGreaterThanOrEqual(2);
		expect(tokens.every(token => token.oauth_account_id === oauthAccountId)).toBe(true);

		expect(tokens.some(token => token.access_token_hash === "other_account_token")).toBe(false);
	});

	it("should return empty array if no tokens found for account", () => {
		const nonExistentAccountId = 9999999;
		const tokens = getOauthTokenByAccountId(nonExistentAccountId);
		expect(Array.isArray(tokens)).toBe(true);
		expect(tokens.length).toBe(0);
	});

	it("should update single field correctly", () => {
		const token = createOauthToken({
			oauth_account_id: oauthAccountId,
			access_token_hash: "update_single_field",
			revoked: false
		});
		const tokenId = (token as any).oauth_token_id;

		const updated = updateOauthToken(tokenId, { access_token_hash: "updated_hash" });
		expect(updated).toBe(true);

		const fetched = getOauthTokenById(tokenId);
		expect(fetched?.access_token_hash).toBe("updated_hash");
	});

	it("should update multiple fields correctly", () => {
		const token = createOauthToken({
			oauth_account_id: oauthAccountId,
			access_token_hash: "multi_field_before",
			scopes: "read"
		});
		const tokenId = (token as any).oauth_token_id;

		const updated = updateOauthToken(tokenId, {
			access_token_hash: "multi_field_after",
			scopes: "read write",
			revoked: true
		});
		expect(updated).toBe(true);

		const fetched = getOauthTokenById(tokenId);
		expect(fetched?.access_token_hash).toBe("multi_field_after");
		expect(fetched?.scopes).toBe("read write");
		expect(fetched?.revoked).toBe(1);
	});

	it("should convert boolean revoked to 1 or 0", () => {
		const token = createOauthToken({
			oauth_account_id: oauthAccountId,
			access_token_hash: "boolean_revoked_test",
			revoked: false
		});
		const tokenId = (token as any).oauth_token_id;

		updateOauthToken(tokenId, { revoked: true });
		let fetched = getOauthTokenById(tokenId);
		expect(fetched?.revoked).toBe(1);

		updateOauthToken(tokenId, { revoked: false });
		fetched = getOauthTokenById(tokenId);
		expect(fetched?.revoked).toBe(0);
	});

	it("should return false when no fields to update", () => {
		const token = createOauthToken({
			oauth_account_id: oauthAccountId,
			access_token_hash: "no_fields_update"
		});
		const tokenId = (token as any).oauth_token_id;

		const result = updateOauthToken(tokenId, {});
		expect(result).toBe(false);

		const result2 = updateOauthToken(tokenId, { access_token_hash: undefined });
		expect(result2).toBe(false);

		// @ts-expect-error
		const result3 = updateOauthToken(tokenId, { revoked: null });
		expect(result3).toBe(false);
	});

	it("should return false when updating a non-existing token", () => {
		const result = updateOauthToken(99999999, { access_token_hash: "no_token" });
		expect(result).toBe(false);
	});

	it("should create a token with null values for optional fields", () => {
		const token = createOauthToken({
			// @ts-expect-error
			oauth_account_id: null,
			access_token_hash: "null_fields_test",
			// @ts-expect-error
			refresh_token_hash: null,
			// @ts-expect-error
			scopes: null,
		});

		expect(token).toBeDefined();
		expect(token?.oauth_account_id).toBeNull();
		expect(token?.refresh_token_hash).toBeNull();
		expect(token?.scopes).toBeNull();
		expect(token?.access_token_hash).toBe("null_fields_test");
	});
});
