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
	getAllOauthTokens
} from "../../../../src/db/wrappers/auth/oauthTokens.js";

import { db } from "../../../../src/db/index.js";

describe("OauthTokens wrapper", () => {
	// --- Prepare an oauth_account before the test suite -----------------------
	let oauthAccountId: number;

	beforeAll(() => {
		// Insert a user (email & password_hash required by schema)
		const insertUserStmt = db.prepare(
			`INSERT INTO users (email, password_hash, role_id) VALUES (?, ?, ?)`
		);
		const u = insertUserStmt.run("OauthTokenUsers@test.com", "hashed-pass", 1);
		const userId = Number(u.lastInsertRowid);

		// Insert an OAuth provider
		const insertProviderStmt = db.prepare(
			`INSERT INTO oauth_providers (name, discovery_url, client_id, is_enabled) VALUES (?, ?, ?, ?)`
		);
		const p = insertProviderStmt.run("TestProvider", "https://testprovider.com/.well-known/openid-configuration", "client-id-123", 1);
		const providerName = "TestProvider";

		// Insert an OAuth account
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
		expect(newToken?.oauth_account_id).toBe(oauthAccountId);
		expect(newToken?.access_token_hash).toBe("access_hash_123");
	});
});
