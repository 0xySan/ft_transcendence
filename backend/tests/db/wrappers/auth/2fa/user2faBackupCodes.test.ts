import { describe, it, expect, beforeAll } from "vitest";
import { db } from "../../../../../src/db/index.js";
import {
    createUser2faBackupCodes,
    getApiTokensById,
    updateApiTokens,
} from "../../../../../src/db/wrappers/auth/2fa/user2faBackupCodes.js";

import { create2FaMethods } from "../../../../../src/db/wrappers/auth/2fa/user2FaMethods.js";

let userId: number;
let methodId: number;
let backupCodeId: number;

describe("user_2fa_backup_codes wrapper – with FK setup", () => {
    beforeAll(() => {
        const insertUser = db.prepare(`
            INSERT INTO users (email, password_hash, role_id)
            VALUES (?, ?, ?)
        `);
        const userRes = insertUser.run("backupcode@example.local", "hashed-password", 1);
        userId = Number(userRes.lastInsertRowid);
        expect(userId).toBeGreaterThan(0);

        const now = Math.floor(Date.now() / 1000);
        const method = create2FaMethods({
            user_id: userId,
            method_type: 3,
            label: "Backup Codes",
            is_primary: 0,
            is_verified: true,
            created_at: now,
            updated_at: now,
        });
        // @ts-expect-error
        methodId = method?.method_id;
        expect(methodId).toBeDefined();
    });

    it("should create a user_2fa_backup_codes entry with valid FK", () => {
        const now = Math.floor(Date.now() / 1000);
        const backup = createUser2faBackupCodes({
            method_id: methodId,
            code_json: JSON.stringify(["code1", "code2", "code3"]),
            created_at: now,
        });
        if (!backup) throw new Error("Expected user2faBackupCodes from createUser2faBackupCodes(), but got undefined.");
        expect(backup).toBeDefined();
        expect(backup.method_id).toBe(methodId);
        expect(typeof backup.code_json).toBe("string");
        expect(backup.code_json).toContain("code1");

        // @ts-expect-error
        backupCodeId = backup.backup_code_id;
        expect(typeof backupCodeId).toBe("number");
    });

    it("should retrieve a user_2fa_backup_codes entry by ID", () => {
        const backup = getApiTokensById(backupCodeId);
        expect(backup).toBeDefined();
        if (!backup) throw new Error("Expected user2faBackupCodes from getApiTokensById(), but got undefined.");
        expect(backup.method_id).toBe(methodId);
        expect(backup.code_json).toContain("code1");
    });

    it("should update code_json and created_at fields", () => {
        const newCodeJson = JSON.stringify(["newcode1", "newcode2"]);
        const newCreatedAt = Math.floor(Date.now() / 1000) + 1000;

        const updated = updateApiTokens(backupCodeId, {
            code_json: newCodeJson,
            created_at: newCreatedAt,
        });
        expect(updated).toBe(true);

        const fetched = getApiTokensById(backupCodeId);
        if (!fetched) throw new Error("Expected user2faBackupCodes from getApiTokensById(), but got undefined.");
        expect(fetched.code_json).toBe(newCodeJson);
        expect(fetched.created_at).toBe(newCreatedAt);
    });

    it("should return false when trying to update nothing", () => {
        const result = updateApiTokens(backupCodeId, {});
        expect(result).toBe(false);
    });

    it("should not allow creation without valid method_id", () => {
        const result = createUser2faBackupCodes({
            method_id: 99999,
            code_json: JSON.stringify(["fail"]),
            created_at: Math.floor(Date.now() / 1000),
        });
        expect(result).toBeUndefined();
    });
});
