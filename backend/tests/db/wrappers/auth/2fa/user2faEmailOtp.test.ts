import { describe, it, expect, beforeAll } from "vitest";
import { v7 as uuidv7 } from "uuid";
import { db } from "../../../../../src/db/index.js";
import {
  createUser2faEmailOtp,
  getUser2faEmailOtpById,
  updateUser2faEmailOtp,
} from "../../../../../src/db/wrappers/auth/2fa/user2faEmailOtp.js";

describe("user2faEmailOtp wrapper - tests", () => {
  let userId: string;
  let methodId: number;
  const now = Date.now();

  beforeAll(() => {
    const insertUser = db.prepare(`
      INSERT INTO users (user_id, email, password_hash, role_id)
	  VALUES (?, ?, ?, ?)
	`);
	userId = uuidv7();
	insertUser.run(userId, "user2fa@example.com", "hashed_pass", 1);

    const insertMethod = db.prepare(`
      INSERT INTO user_2fa_methods (user_id, method_type, label, is_primary, is_verified)
      VALUES (?, ?, ?, ?, ?)
    `);
    const resMethod = insertMethod.run(userId, 1, "email", 1, 1);
    methodId = Number(resMethod.lastInsertRowid);
  });

  it("should create a new user2faEmailOtp with all required fields", () => {
    const otp = createUser2faEmailOtp({
      method_id: methodId,
      last_sent_code_hash: "hashed_code_123",
      last_sent_at: now,
      attempts: 2,
      consumed: 1,
      expires_at: now + 60000,
    });

    if (!otp) throw new Error("Throw error (undefined)");
    expect(otp.attempts).toBe(2);
    expect(otp.consumed).toBe(1);
  });

  it("should default attempts and consumed to 0 if not provided", () => {
    const otp = createUser2faEmailOtp({
      method_id: methodId,
      last_sent_code_hash: "hashed_code_default",
      last_sent_at: now,
      expires_at: now + 60000,
    });

    if (!otp) throw new Error("Throw error (undefined)");
    expect(otp.attempts).toBe(0);
    expect(otp.consumed).toBe(0);
  });

  it("should retrieve user2faEmailOtp by ID", () => {
    const created = createUser2faEmailOtp({
      method_id: methodId,
      last_sent_code_hash: "hashed_code_retrieve",
      last_sent_at: now,
      expires_at: now + 60000,
    });

    if (!created) throw new Error("Throw error (undefined)");
    const otpId = created.email_otp_id;
    const retrieved = getUser2faEmailOtpById(otpId);

    if (!retrieved) throw new Error("Throw error (undefined)");
    expect(retrieved.last_sent_code_hash).toBe("hashed_code_retrieve");
  });

  it("should return undefined for non-existing email_otp_id", () => {
    const result = getUser2faEmailOtpById(9999999);
    expect(result).toBeUndefined();
  });

  it("should update fields of user2faEmailOtp", () => {
    const created = createUser2faEmailOtp({
      method_id: methodId,
      last_sent_code_hash: "hashed_code_update",
      last_sent_at: now,
      expires_at: now + 60000,
    });

    const otpId = (created as any).email_otp_id;
    const updated = updateUser2faEmailOtp(otpId, {
      attempts: 5,
      consumed: 3,
      last_sent_at: now + 5000,
    });

    expect(updated).toBe(true);

    const updatedOtp = getUser2faEmailOtpById(otpId);
    if (!updatedOtp) throw new Error("Throw error (undefined)");
    expect(updatedOtp.attempts).toBe(5);
    expect(updatedOtp.consumed).toBe(3);
    expect(updatedOtp.last_sent_at).toBe(now + 5000);
  });

  it("should return false when no valid fields are provided for update", () => {
    const created = createUser2faEmailOtp({
      method_id: methodId,
      last_sent_code_hash: "hashed_code_no_update",
      last_sent_at: now,
      expires_at: now + 60000,
    });

    const otpId = (created as any).email_otp_id;
    const updated = updateUser2faEmailOtp(otpId, {});
    expect(updated).toBe(false);
  });

  it("should return false when updating non-existing email_otp_id", () => {
    const updated = updateUser2faEmailOtp(9999999, { attempts: 1 });
    expect(updated).toBe(false);
  });

  it("should cascade delete user2faEmailOtp when user_2fa_methods is deleted", () => {
    const created = createUser2faEmailOtp({
      method_id: methodId,
      last_sent_code_hash: "hashed_code_cascade",
      last_sent_at: now,
      expires_at: now + 60000,
    });

    const otpId = (created as any).email_otp_id;

    db.prepare(`DELETE FROM user_2fa_methods WHERE method_id = ?`).run(methodId);

    const otp = getUser2faEmailOtpById(otpId);
    expect(otp).toBeUndefined();
  });
});
