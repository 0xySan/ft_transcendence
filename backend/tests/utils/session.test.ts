/**
 * @file session.test.ts
 * Tests for session.ts utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as sessionModule from "../../src/utils/session.js";
import * as cryptoModule from "../../src/utils/crypto.js";
import * as dbModule from "../../src/db/wrappers/auth/sessions.js";

describe("session utilities", () => {
	let randomTokenSpy: any;
	let tokenHashSpy: any;
	let createSessionSpy: any;
	let getSessionByTokenHashSpy: any;

	beforeEach(() => {
		vi.restoreAllMocks();

		// Mock crypto functions
		randomTokenSpy = vi.spyOn(cryptoModule, "generateRandomToken").mockReturnValue("dummyToken");
		tokenHashSpy = vi.spyOn(cryptoModule, "tokenHash").mockImplementation((token: string) => token + "_hashed");

		// Mock DB functions
		createSessionSpy = vi.spyOn(dbModule, "createSession").mockImplementation((data: any) => ({
			...data,
			id: 1
		}));
		getSessionByTokenHashSpy = vi.spyOn(dbModule, "getSessionByTokenHash").mockImplementation(() => ({
			id: 1,
			user_id: "42",
			session_token_hash: "dummyToken_hashed",
			expires_at: Math.floor(Date.now() / 1000) + 1000,
			is_persistent: false,
			created_at: Math.floor(Date.now() / 1000),
			last_used_at: Math.floor(Date.now() / 1000),
			stage: "active",
			ip: "127.0.0.1",
			user_agent: "test-agent",
		}));
	});


	afterEach(() => {
		vi.resetAllMocks();
	});

	it("createNewSession should return session and token", () => {
		const result = sessionModule.createNewSession("42", { ip: "127.0.0.1", userAgent: "test-agent" });

		expect(result).toBeDefined();
		expect(result?.token).toBe("dummyToken");
		expect(result?.session).toHaveProperty("id");
		expect(createSessionSpy).toHaveBeenCalled();
		expect(randomTokenSpy).toHaveBeenCalledWith(128);
		expect(tokenHashSpy).toHaveBeenCalledWith("dummyToken");
	});

	it("createNewSession should return undefined if DB creation fails", () => {
		createSessionSpy.mockReturnValueOnce(undefined);
		const result = sessionModule.createNewSession("42");
		expect(result).toBeUndefined();
	});

	it("checkTokenValidity should return true for valid session", () => {
		const isValid = sessionModule.checkTokenValidity("dummyToken");
		expect(isValid).toEqual({ isValid: true, session: expect.objectContaining({ user_id: "42" }) });
		expect(tokenHashSpy).toHaveBeenCalledWith("dummyToken");
		expect(getSessionByTokenHashSpy).toHaveBeenCalled();
	});

	it("checkTokenValidity should return false if session not found", () => {
		getSessionByTokenHashSpy.mockReturnValueOnce(undefined);
		const isValid = sessionModule.checkTokenValidity("nonexistentToken");
		expect(isValid).toEqual({ isValid: false, session: null });
	});

	it("checkTokenValidity should return false if session expired", () => {
		const expiredTime = Math.floor(Date.now() / 1000) - 1000;
		getSessionByTokenHashSpy.mockReturnValueOnce({
			id: 1,
			user_id: 42,
			session_token_hash: "dummyToken_hashed",
			expires_at: expiredTime,
			is_persistent: false
		});
		const isValid = sessionModule.checkTokenValidity("dummyToken");
		expect(isValid).toEqual({ isValid: false, session: expect.objectContaining({ user_id: 42 }) });
	});
});
