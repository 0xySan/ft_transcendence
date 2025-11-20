import { describe, it, expect, beforeAll } from "vitest";
import { v7 as uuidv7 } from "uuid";

import { db } from "../../../../../src/db/index.js";
import {
	createUser2faTotp,
	getUser2faTotpById,
	updateUser2faTotp,
	listUser2faTotp,
	getUser2faTotpByMethodId,
	getUserTotpMethodById
} from "../../../../../src/db/wrappers/auth/2fa/user2faTotp.js";

import {
	create2FaMethods
} from "../../../../../src/db/wrappers/auth/2fa/user2FaMethods.js";

let userId: string;
let methodId: string;
let totpId: number;

describe("user2faTotp wrapper – with FK setup", () => {
	beforeAll(() => {
		userId = uuidv7();
		const insertUser = db.prepare(`
			INSERT INTO users (user_id, email, password_hash, role_id)
			VALUES (?, ?, ?, ?)
		`);
		insertUser.run(userId, "totp@example.local", "hashed-password", 1);

		const now = Math.floor(Date.now() / 1000);
		const method = create2FaMethods({
			user_id: userId,
			method_type: 2,
			label: "App Authenticator",
			is_primary: true,
			is_verified: true,
			created_at: now,
			updated_at: now
		});
		if (!method) throw new Error("Throw error (undefined)");
		methodId = method.method_id;
		if (!methodId) throw new Error("Throw error (undefined)");
	});

	it("should create a user2faTotp entry with valid FK", () => {
		const now = Math.floor(Date.now() / 1000);
		const created = createUser2faTotp({
			method_id: methodId,
            // @ts-expect-error
			secret_encrypted: Buffer.from("secret-totp"),
			secret_meta: "digits=6;period=30",
			last_used: now
		});
        if (!created) throw new Error("Expected an user2faTotp from createUser2faTotp(), but got undefined.");
		expect(created).toBeDefined();
		expect(created.method_id).toBe(methodId);
		expect(created.secret_meta).toContain("digits");

		totpId = created!.totp_id;
		expect(typeof totpId).toBe("number");
	});

	it("should retrieve a user2faTotp entry by ID", () => {
		const totp = getUser2faTotpById(totpId);
		expect(totp).toBeDefined();
        if (!totp) throw new Error("Expected an user2faTotp from getSessionById(), but got undefined.");
		expect(totp.method_id).toBe(methodId);
		expect(totp.secret_meta).toMatch(/period=30/);
	});

	it("should update secret_meta and last_used fields", () => {
		const updated = updateUser2faTotp(totpId, {
			secret_meta: "digits=8;period=60",
			last_used: 1800000000
		});
		expect(updated).toBe(true);

		const fetched = getUser2faTotpById(totpId);
        if (!fetched) throw new Error("Expected an user2faTotp from getSessionById(), but got undefined.");
		expect(fetched.secret_meta).toContain("digits=8");
		expect(fetched.last_used).toBe(1800000000);
	});

	it("should return false when trying to update nothing", () => {
		const result = updateUser2faTotp(totpId, {});
		expect(result).toBe(false);
	});

	it("should not allow creation without valid method_id", () => {
		const result = createUser2faTotp({
			method_id: "non-existent-method-id",
            // @ts-expect-error
			secret_encrypted: Buffer.from("bad"),
			secret_meta: "fail"
		});
		expect(result).toBeUndefined();
	});

	it("should retrieve user2faTotp by method_id", () => {
        const totp = getUser2faTotpByMethodId(methodId);
        if (!totp) throw new Error("Expected an user2faTotp from getUser2faTotpByMethodId(), but got undefined.");
        expect(totp).toBeDefined();
        expect(totp.method_id).toBe(methodId);
        expect(totp.secret_encrypted).toBeInstanceOf(Buffer);
    });

	it("should list all user2faTotp entries", () => {
		const allTotps = listUser2faTotp();
		expect(Array.isArray(allTotps)).toBe(true);
		expect(allTotps.length).toBeGreaterThan(0);
		allTotps.forEach(totp => {
            expect(totp.method_id).toBeDefined();
            expect(totp.secret_encrypted).toBeInstanceOf(Buffer);
            // @ts-expect-error
            const secretString = totp.secret_encrypted.toString("base64");
            expect(typeof secretString).toBe("string");
        });
	});

	it("getUserTotpMethodById should return undefined for non-existent ID", () => {
		const totp = getUserTotpMethodById("non-existent-method-id");
		expect(totp).toBeUndefined();
	});

	it("getUserTotpMethodById should return correct data for existing ID", () => {
		const insertMethod = db.prepare(`
			INSERT INTO user_2fa_methods (method_id, user_id, method_type, label, is_primary, is_verified, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`);
		const now = Math.floor(Date.now() / 1000);
		const newMethodId = "test-method-123";
		insertMethod.run(
			newMethodId,
			userId,
			1,
			"Test TOTP Method",
			0,
			1,
			now,
			now
		);
		const insertTotp = db.prepare(`
			INSERT INTO user_2fa_totp (method_id, secret_encrypted, secret_meta, last_used)
			VALUES (?, ?, ?, ?)
		`);
		insertTotp.run(
			newMethodId,
			Buffer.from("another-secret"),
			"digits=6;period=30",
			now
		);

		const result = getUserTotpMethodById(newMethodId);
		if (!result) throw new Error("Expected a User2FaTotpDetails from getUserTotpMethodById(), but got undefined.");
		expect(result).toBeDefined();
		expect(result.method.method_id).toBe(newMethodId);
		expect(result.totp.secret_meta).toBe("digits=6;period=30");
	});
});
