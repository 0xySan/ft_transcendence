import { describe, it, expect, beforeAll } from "vitest";
import { db } from "../../../../src/db/index.js";
import {
	createSession,
	getSessionById,
	updateSession,
	getSessionByTokenHash,
	getActiveSessionsByIp,
	getActiveSessionsByUserId,
	getSessionsByUserId
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
		const longAgent = "A".repeat(1024);
		const session = createSession({
			user_id: userId,
			session_token_hash: "long_agent_token",
			expires_at: Math.floor(Date.now() / 1000) + 3000,
			last_used_at: Math.floor(Date.now() / 1000),
			ip: "8.8.8.8",
			user_agent: longAgent,
			is_persistent: false,
		});
		if (!session) throw new Error("Throw error (undefined)");
		expect(session.user_agent.length).toBe(1024);
	});

	it("should store a persistent session correctly", () => {
		const now = Math.floor(Date.now() / 1000);
		const session = createSession({
			user_id: userId,
			session_token_hash: "persistent_token",
			expires_at: now + 86400 * 30,
			last_used_at: now,
			ip: "10.10.10.10",
			user_agent: "PersistentSession",
			is_persistent: true
		});
		expect(session).toBeDefined();
		if (!session) throw new Error("Throw error (undefined)");
		expect(session.is_persistent).toBe(1);
	});

	it("should reject session creation with missing required fields", () => {
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

	it("should retrieve session by token hash", () => {
		const token = "token_by_hash";
		const session = createSession({
			user_id: userId,
			session_token_hash: token,
			expires_at: Math.floor(Date.now() / 1000) + 3600,
			last_used_at: Math.floor(Date.now() / 1000),
			ip: "123.123.123.123",
			user_agent: "TokenHashTest",
			is_persistent: false,
		});
		expect(session).toBeDefined();

		const found = getSessionByTokenHash(token);
        if (!found)throw new Error("Expected an OAuth account from getSessionByTokenHash, but got undefined.");
		expect(found).toBeDefined();
		expect(found.session_token_hash).toBe(token);
	});

	it("should return undefined for unknown token hash", () => {
		const result = getSessionByTokenHash("non_existent_token");
		expect(result).toBeUndefined();
	});

	it("should return all sessions for a given user ID", () => {
		createSession({
			user_id: userId,
			session_token_hash: "multi_session_1",
			expires_at: Math.floor(Date.now() / 1000) + 5000,
			last_used_at: Math.floor(Date.now() / 1000),
			ip: "1.1.1.1",
			user_agent: "Multi1",
			is_persistent: false,
		});
		createSession({
			user_id: userId,
			session_token_hash: "multi_session_2",
			expires_at: Math.floor(Date.now() / 1000) + 5000,
			last_used_at: Math.floor(Date.now() / 1000),
			ip: "2.2.2.2",
			user_agent: "Multi2",
			is_persistent: true,
		});

		const sessions = getSessionsByUserId(userId);
		expect(Array.isArray(sessions)).toBe(true);
		expect(sessions.length).toBeGreaterThanOrEqual(2);
	});

	it("should return only active sessions by IP", () => {
		const now = Math.floor(Date.now() / 1000);
		const targetIP = "9.9.9.9";

		createSession({
			user_id: userId,
			session_token_hash: "expired_ip",
			expires_at: now - 50,
			last_used_at: now - 100,
			ip: targetIP,
			user_agent: "ExpiredIPSession",
			is_persistent: false,
		});

		createSession({
			user_id: userId,
			session_token_hash: "active_ip",
			expires_at: now + 500,
			last_used_at: now,
			ip: targetIP,
			user_agent: "ActiveIPSession",
			is_persistent: true,
		});

		const sessions = getActiveSessionsByIp(targetIP);
		expect(Array.isArray(sessions)).toBe(true);
		expect(sessions.length).toBeGreaterThanOrEqual(1);
		expect(sessions.every(s => s.ip === targetIP && s.expires_at > now)).toBe(true);
	});

	it("should return only active (non-expired) sessions for a user", () => {
		const now = Math.floor(Date.now() / 1000);

		createSession({
			user_id: userId,
			session_token_hash: "expired_session_user",
			expires_at: now - 100,
			last_used_at: now - 200,
			ip: "3.3.3.3",
			user_agent: "ExpiredUserSession",
			is_persistent: false,
		});

		createSession({
			user_id: userId,
			session_token_hash: "active_session_user",
			expires_at: now + 3600,
			last_used_at: now,
			ip: "4.4.4.4",
			user_agent: "ActiveUserSession",
			is_persistent: true,
		});

		const active = getActiveSessionsByUserId(userId);
		expect(Array.isArray(active)).toBe(true);
		expect(active.length).toBeGreaterThanOrEqual(1);
		expect(active.every(s => s.expires_at > now)).toBe(true);
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
			ip: "::1",
			user_agent: "IPv6Tester",
			is_persistent: false
		});
        if (!session)throw new Error("Expected an sessions from createSession(), but got undefined.");
		expect(session).toBeDefined();
		expect(session.ip).toBe("::1");
	});

	it("should allow expired sessions to be stored (but not recommended)", () => {
		const now = Math.floor(Date.now() / 1000);
		const session = createSession({
			user_id: userId,
			session_token_hash: "expired_session",
			expires_at: now - 10,
			last_used_at: now - 20,
			ip: "0.0.0.0",
			user_agent: "ExpiredAgent",
			is_persistent: false
		});
        if (!session)throw new Error("Expected an sessions from createSession(), but got undefined.");
		expect(session).toBeDefined();
		expect(session.expires_at).toBeLessThan(now);
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

		const fetched = getSessionById(sessionId);
        if (!fetched)throw new Error("Expected an sessions from getSessionById(), but got undefined.");
		expect(fetched.ip).toBe("4.3.2.1");
		expect(fetched.user_agent).toBe("UpdatedAgent");
		expect(fetched.is_persistent).toBe(1);
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

	it("getActiveSessionsByUserId returns empty array on db.prepare error", () => {
		// @ts-expect-error
		const spy = vi.spyOn(db, "prepare").mockImplementation(() => {
			throw new Error("DB failure");
		});
		const result = getActiveSessionsByUserId(userId);
		expect(result).toEqual([]);
		spy.mockRestore();
	});

	it("getActiveSessionsByUserId returns empty array on stmt.all error", () => {
		// @ts-expect-error
		const fakeStmt = { all: vi.fn(() => { throw new Error("DB failure"); }) };
		// @ts-expect-error
		const spy = vi.spyOn(db, "prepare").mockReturnValue(fakeStmt as any);
		const result = getActiveSessionsByUserId(userId);
		expect(result).toEqual([]);
		spy.mockRestore();
	});

	it("getActiveSessionsByIp returns empty array on db.prepare error", () => {
		// @ts-expect-error
		const spy = vi.spyOn(db, "prepare").mockImplementation(() => {
			throw new Error("DB failure");
		});
		const result = getActiveSessionsByIp("127.0.0.1");
		expect(result).toEqual([]);
		spy.mockRestore();
	});

	it("getActiveSessionsByIp returns empty array on stmt.all error", () => {
		// @ts-expect-error
		const fakeStmt = { all: vi.fn(() => { throw new Error("DB failure"); }) };
		// @ts-expect-error
		const spy = vi.spyOn(db, "prepare").mockReturnValue(fakeStmt as any);
		const result = getActiveSessionsByIp("127.0.0.1");
		expect(result).toEqual([]);
		spy.mockRestore();
	});

	it("should default is_persistent to 0 if not provided", () => {
		const now = Math.floor(Date.now() / 1000);
		const session = createSession({
			user_id: userId,
			session_token_hash: "default_persistent_test",
			expires_at: now + 3600,
			last_used_at: now,
			ip: "127.0.0.1",
			user_agent: "defaultPersistent"
		});
        if (!session)throw new Error("Expected an sessions from createSession(), but got undefined.");
		expect(session).toBeDefined();
		expect(session.is_persistent).toBe(0);
	});

	it("should store is_persistent as 1 when truthy (like true)", () => {
		const now = Math.floor(Date.now() / 1000);
		const session = createSession({
			user_id: userId,
			session_token_hash: "persistent_true",
			expires_at: now + 3600,
			last_used_at: now,
			ip: "127.0.0.1",
			user_agent: "persistentTrue",
			is_persistent: true
		});
        if (!session)throw new Error("Expected an sessions from createSession(), but got undefined.");
		expect(session).toBeDefined();
		expect(session.is_persistent).toBe(1);
	});

	it("should store is_persistent as 0 when falsy (like false)", () => {
		const now = Math.floor(Date.now() / 1000);
		const session = createSession({
			user_id: userId,
			session_token_hash: "persistent_false",
			expires_at: now + 3600,
			last_used_at: now,
			ip: "127.0.0.1",
			user_agent: "persistentFalse",
			is_persistent: false
		});
        if (!session)throw new Error("Expected an sessions from createSession(), but got undefined.");
		expect(session).toBeDefined();
		expect(session.is_persistent).toBe(0);
	});

	it("should update is_persistent correctly to 1", () => {
		const now = Math.floor(Date.now() / 1000);
		const session = createSession({
			user_id: userId,
			session_token_hash: "update_persistent_to_1",
			expires_at: now + 3600,
			last_used_at: now,
			ip: "8.8.8.8",
			user_agent: "updatePersistent",
			is_persistent: false
		});
		expect(session).toBeDefined();
		const sessionId = (session as any).session_id;

		const updated = updateSession(sessionId, { is_persistent: true });
		expect(updated).toBe(true);

		const fetched = getSessionById(sessionId);
        if (!fetched)throw new Error("Expected an sessions from getSessionById(), but got undefined.");
		expect(fetched.is_persistent).toBe(1);
	});

	it("should update is_persistent correctly to 0", () => {
		const now = Math.floor(Date.now() / 1000);
		const session = createSession({
			user_id: userId,
			session_token_hash: "update_persistent_to_0",
			expires_at: now + 3600,
			last_used_at: now,
			ip: "8.8.4.4",
			user_agent: "updatePersistentZero",
			is_persistent: true
		});
		expect(session).toBeDefined();
		const sessionId = (session as any).session_id;

		const updated = updateSession(sessionId, { is_persistent: false });
		expect(updated).toBe(true);

		const fetched = getSessionById(sessionId);
        if (!fetched)throw new Error("Expected an sessions from getSessionById(), but got undefined.");
		expect(fetched.is_persistent).toBe(0);
	});

	it("should ignore fields that are undefined or null in updateSession", () => {
		const now = Math.floor(Date.now() / 1000);
		const session = createSession({
			user_id: userId,
			session_token_hash: "ignore_undefined_null",
			expires_at: now + 3600,
			last_used_at: now,
			ip: "9.9.9.9",
			user_agent: "ignoreUndefined",
			is_persistent: true
		});
		expect(session).toBeDefined();
		const sessionId = (session as any).session_id;

		const updated = updateSession(sessionId, {
			ip: undefined,
			// @ts-expect-error
			user_agent: null
		});
		expect(updated).toBe(false);

		const fetched = getSessionById(sessionId);
        if (!fetched)throw new Error("Expected an sessions from getSessionById(), but got undefined.");
		expect(fetched.ip).toBe("9.9.9.9");
		expect(fetched.user_agent).toBe("ignoreUndefined");
	});

	it("should update multiple fields including is_persistent correctly", () => {
		const now = Math.floor(Date.now() / 1000);
		const session = createSession({
			user_id: userId,
			session_token_hash: "multi_field_update",
			expires_at: now + 3600,
			last_used_at: now,
			ip: "1.1.1.1",
			user_agent: "multiUpdateAgent",
			is_persistent: false
		});
		expect(session).toBeDefined();
		const sessionId = (session as any).session_id;

		const updated = updateSession(sessionId, {
			ip: "2.2.2.2",
			user_agent: "updatedAgent",
			is_persistent: true
		});
		expect(updated).toBe(true);

		const fetched = getSessionById(sessionId);
        if (!fetched)throw new Error("Expected an sessions from getSessionById(), but got undefined.");
		expect(fetched.ip).toBe("2.2.2.2");
		expect(fetched.user_agent).toBe("updatedAgent");
		expect(fetched.is_persistent).toBe(1);
	});
});
