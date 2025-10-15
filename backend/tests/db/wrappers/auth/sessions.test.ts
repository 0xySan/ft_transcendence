import { describe, it, expect, beforeAll } from "vitest";
import { db } from "../../../../src/db/index.js";
import {
	createSession,
	getSessionsById,
	updateSession
} from "../../../../src/db/wrappers/auth/sessions.js";

describe("sessions wrapper - extended tests", () => {
	let userId: number;
	let createdSessionId: number | undefined;

	beforeAll(() => {
		try {
			db.prepare(`INSERT OR IGNORE INTO user_roles (role_id, name) VALUES (?, ?)`).run(1, "testRole");
		} catch {}

		const insertUser = db.prepare(`
			INSERT INTO users (email, password_hash, role_id)
			VALUES (?, ?, ?)
		`);
		const res = insertUser.run("extended_user@example.local", "hashed-password", 1);
		userId = Number(res.lastInsertRowid);
	});

	it("should store very long user agent string", () => {
		const longAgent = "A".repeat(1024); // 1 KB string
		const session = createSession({
			user_id: userId,
			session_token_hash: "long_agent_token",
			expires_at: Math.floor(Date.now() / 1000) + 3000,
			last_used_at: Math.floor(Date.now() / 1000),
			ip: "8.8.8.8",
			user_agent: longAgent,
			is_persistent: false,
		});
		expect(session).toBeDefined();
		expect(session?.user_agent.length).toBe(1024);
	});

	it("should reject session creation with missing required fields", () => {
		// missing token_hash, expires_at, etc.
		const session = createSession({
			user_id: userId
		});
		expect(session).toBeUndefined();
	});

	it("should reject non-number inputs where numbers are expected", () => {
		const session = createSession({
			user_id: userId,
			session_token_hash: "invalid_types",
			// @ts-expect-error
			expires_at: "not-a-number",
			// @ts-expect-error
			last_used_at: "wrong",
			ip: "1.1.1.1",
			user_agent: "BadAgent",
			is_persistent: false
		});
		expect(session).toBeUndefined();
	});

    it("should reject non-number inputs where numbers are expected", () => {
		const session = createSession({
			user_id: userId,
			session_token_hash: "invalid_types",
			expires_at: 45646465,
			// @ts-expect-error
			last_used_at: "wrong",
			ip: "1.1.1.1",
			user_agent: "BadAgent",
			is_persistent: false
		});
		expect(session).toBeUndefined();
	});

	it("should accept IPv6 formatted IPs", () => {
		const session = createSession({
			user_id: userId,
			session_token_hash: "ipv6_token",
			expires_at: Math.floor(Date.now() / 1000) + 5000,
			last_used_at: Math.floor(Date.now() / 1000),
			ip: "::1", // localhost IPv6
			user_agent: "IPv6Tester",
			is_persistent: false
		});
		expect(session).toBeDefined();
		expect(session?.ip).toBe("::1");
	});

	it("should allow expired sessions to be stored (but not recommended)", () => {
		const now = Math.floor(Date.now() / 1000);
		const session = createSession({
			user_id: userId,
			session_token_hash: "expired_session",
			expires_at: now - 10, // already expired
			last_used_at: now - 20,
			ip: "0.0.0.0",
			user_agent: "ExpiredAgent",
			is_persistent: false
		});
		expect(session).toBeDefined();
		expect(session?.expires_at).toBeLessThan(now);
	});

	it("should update multiple fields simultaneously", () => {
		const session = createSession({
			user_id: userId,
			session_token_hash: "multi_update_token",
			expires_at: Math.floor(Date.now() / 1000) + 6000,
			last_used_at: Math.floor(Date.now() / 1000),
			ip: "1.2.3.4",
			user_agent: "MultiUpdate",
			is_persistent: false
		});
		expect(session).toBeDefined();
		const sessionId = (session as any).session_id;

		const updated = updateSession(sessionId, {
			ip: "4.3.2.1",
			is_persistent: true,
			user_agent: "UpdatedAgent"
		});
		expect(updated).toBe(true);

		const fetched = getSessionsById(sessionId);
		expect(fetched?.ip).toBe("4.3.2.1");
		expect(fetched?.user_agent).toBe("UpdatedAgent");
		expect(fetched?.is_persistent).toBe(1);
	});

	it("should return false when updating a session with only undefined fields", () => {
		const session = createSession({
			user_id: userId,
			session_token_hash: "undefined_update",
			expires_at: Math.floor(Date.now() / 1000) + 3600,
			last_used_at: Math.floor(Date.now() / 1000),
			ip: "5.5.5.5",
			user_agent: "UndefAgent",
			is_persistent: false
		});
		const sessionId = (session as any).session_id;

		const updated = updateSession(sessionId, {
			ip: undefined,
			// @ts-expect-error
			user_agent: null
		});
		expect(updated).toBe(false);
	});
});
