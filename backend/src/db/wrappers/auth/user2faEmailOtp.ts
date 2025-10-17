/**
 * Wrapper functions for interacting with the `user2faEmailOtp` table.
 * Provides retrieval, creation, and listing utilities.
*/

import { db, insertRow, getRow } from "../../index.js";

export interface user2faEmailOtp {
    method_id:              number;
    last_sent_code_hash:    string;
    last_sent_at:           number;
    attempts:               number;
    consumed:               number;
    expires_at:             number;
}

/**
 * Retrieve a user2faEmailOtp by its ID.
 * @param id - The primary key of the user2faEmailOtp
 * @returns The user2faEmailOtp object if found, otherwise undefined
 */
export function getUser2faEmailOtpById(id: number): user2faEmailOtp | undefined {
    return (getRow<user2faEmailOtp>("user_2fa_email_otp", "email_otp_id", id));
}

/**
 * Create a new user2faEmailOtp if it doesn't exist.
 * Default values will be applied for missing fields.
 * Uses the generic insertRow wrapper to insert and fetch the user2faEmailOtp.
 * 
 * @param options - Partial user2faEmailOtp object with method_id, last_sent_code_hash, last_sent_at, attempts, consumed, expires_at
 * @returns The newly created or existing user2faEmailOtp object, or undefined if insertion failed
 */
export function createUser2faEmailOtp(options: Partial<user2faEmailOtp>): user2faEmailOtp | undefined {
    const   method_id = (options.method_id);
    const   last_sent_code_hash = (options.last_sent_code_hash);
    const   last_sent_at = (options.last_sent_at);
    const   attempts = (options.attempts ?? 0);
    const   consumed = (options.consumed ?? 0);
    const   expires_at = (options.expires_at);

    return (insertRow<user2faEmailOtp>("user_2fa_email_otp", {
        method_id: method_id,
        last_sent_code_hash: last_sent_code_hash,
        last_sent_at: last_sent_at,
        attempts: attempts,
        consumed: consumed,
        expires_at: expires_at
    }));
}

/**
 * Update user2faEmailOtp.
 * Only updates the provided fields.
 * 
 * @param app_id - The provider ID
 * @param options - Partial information to update
 * @returns true if updated, false otherwise
 */
export function updateUser2faEmailOtp(email_otp_id: number, options: Partial<user2faEmailOtp>): boolean {
    const keys = Object.keys(options).filter(
        key => options[key as keyof user2faEmailOtp] !== undefined && options[key as keyof user2faEmailOtp] !== null
    );

    if (keys.length === 0) return false;

    const setClause = keys.map(key => `${key} = @${key}`).join(", ");

    const params: Record<string, unknown> = { email_otp_id };
    for (const key of keys) {
        params[key] = options[key as keyof user2faEmailOtp];
    }

    const stmt = db.prepare(`
        UPDATE user_2fa_email_otp
        SET ${setClause}
        WHERE email_otp_id = @email_otp_id
    `);

    const result = stmt.run(params);

    return (result.changes > 0);
}