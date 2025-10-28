import { describe, it, expect, beforeAll } from "vitest";
import { db } from "../../../../../src/db/index.js";
import {
	createUser2faTotp,
	getUser2faTotpById,
	updateUser2faTotp,
	listUser2faTotp,
	getUser2faTotpByMethodId
} from "../../../../../src/db/wrappers/auth/2fa/user2faTotp.js";

import {
	create2FaMethods
} from "../../../../../src/db/wrappers/auth/2fa/user2FaMethods.js";

let userId: number;
let methodId: number;
let totpId: number;

describe("user_2fa_totp wrapper – with FK setup", () => {
	beforeAll(() => {
		const insertUser = db.prepare(`
			INSERT INTO users (email, password_hash, role_id)
			VALUES (?, ?, ?)
		`);
		const userRes = insertUser.run("totp@example.local", "hashed-password", 1);
		userId = Number(userRes.lastInsertRowid);

		const now = Math.floor(Date.now() / 1000);
		const method = create2FaMethods({
			user_id: userId,
			method_type: 2,
			label: "App Authenticator",
			is_primary: 1,
			is_verified: true,
			created_at: now,
			updated_at: now
		});
		if (!method) throw new Error("Throw error (undefined)");
		methodId = method.method_id;
		if (!methodId) throw new Error("Throw error (undefined)");
	});

	it("should create a user_2fa_totp entry with valid FK", () => {
		const now = Math.floor(Date.now() / 1000);
		const created = createUser2faTotp({
			method_id: methodId,
            // @ts-expect-error
			secret_encrypted: Buffer.from("secret-totp"),
			secret_meta: "digits=6;period=30",
			last_used: now
		});
        if (!created)throw new Error("Expected an user2faTotp from createUser2faTotp(), but got undefined.");
		expect(created).toBeDefined();
		expect(created.method_id).toBe(methodId);
		expect(created.secret_meta).toContain("digits");

		totpId = created!.totp_id;
		expect(typeof totpId).toBe("number");
	});

	it("should retrieve a user_2fa_totp entry by ID", () => {
		const totp = getUser2faTotpById(totpId);
		expect(totp).toBeDefined();
        if (!totp)throw new Error("Expected an user2faTotp from getSessionById(), but got undefined.");
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
        if (!fetched)throw new Error("Expected an user2faTotp from getSessionById(), but got undefined.");
		expect(fetched.secret_meta).toContain("digits=8");
		expect(fetched.last_used).toBe(1800000000);
	});

	it("should return false when trying to update nothing", () => {
		const result = updateUser2faTotp(totpId, {});
		expect(result).toBe(false);
	});

	it("should not allow creation without valid method_id", () => {
		const result = createUser2faTotp({
			method_id: 99999,
            // @ts-expect-error
			secret_encrypted: Buffer.from("bad"),
			secret_meta: "fail"
		});
		expect(result).toBeUndefined();
	});

	it("should retrieve user_2fa_totp by method_id", () => {
        const totp = getUser2faTotpByMethodId(methodId);
        if (!totp)throw new Error("Expected an user2faTotp from getUser2faTotpByMethodId(), but got undefined.");
        expect(totp).toBeDefined();
        expect(totp.method_id).toBe(methodId);
        expect(totp.secret_encrypted).toBeInstanceOf(Buffer);
    });

	it("should list all user_2fa_totp entries", () => {
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
});
