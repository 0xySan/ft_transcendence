import { db, getRow, user2faBackupCodes, user2faEmailOtp, user2faTotp } from "../../../index.js";
import { v7 as uuidv7 } from "uuid";

/**
 * User 2FA Methods Interface
 * @constant
 * method_type:
 * 	0 = Email
 * 	1 = Authenticator App (TOTP)
 * 	2 = Backup Codes
 */
export interface user2FaMethods {
	method_id:		string;
	user_id:		string;
	method_type:	0 | 1 | 2;
	label:			string | null;
	is_primary:		boolean;
	is_verified:	boolean;
	created_at:		number;
	updated_at:		number;
}

export type User2FaMethodRecord = 
	| user2faEmailOtp
	| user2faTotp
	| user2faBackupCodes;

/**
 * Get User 2FA Method by ID
 * @param id The method ID
 * @returns The User 2FA Method or undefined if not found
 */
export function getUser2FaMethodsById(id: string): user2FaMethods | undefined {
	return (getRow<user2FaMethods>("user_2fa_methods", "method_id", id));
}

/**
 * Get all 2FA methods for a user
 * @param user_id The user ID
 * @returns An array of User 2FA Methods
 */
export function getUser2FaMethodsByUserId(user_id: string): user2FaMethods[] {
	const stmt = db.prepare("SELECT * FROM user_2fa_methods WHERE user_id = ?");
	return stmt.all(user_id) as user2FaMethods[];
}

/**
 * Get primary 2FA method for a user
 * @param user_id The user ID
 * @returns The primary User 2FA Method or undefined if not found
 */
export function getPrimary2FaMethodByUserId(user_id: string): user2FaMethods | undefined {
	const stmt = db.prepare("SELECT * FROM user_2fa_methods WHERE user_id = ? AND is_primary = 1");
	return stmt.get(user_id) as user2FaMethods | undefined;
}

/**
 * Create a new User 2FA Method
 * @param options Partial user2FaMethods object
 * @returns The created User 2FA Method or undefined on failure
 */
export function create2FaMethods(options: Partial<user2FaMethods>): user2FaMethods | undefined {
	const method_id = (typeof options.method_id === "string" && options.method_id.length > 0) ? options.method_id : uuidv7();
	const user_id = options.user_id;
	const method_type = options.method_type;
	const label = (typeof options.label === "string") ? options.label : null;
	const is_primary = (options.is_primary ? 1 : 0);
	const is_verified = (options.is_verified ? 1 : 0);
	const created_at = (typeof options.created_at === "number") ? options.created_at : Date.now();
	const updated_at = (typeof options.updated_at === "number") ? options.updated_at : created_at;

	if (typeof user_id !== "string" || typeof method_type !== "number") return undefined;

	try {
		const stmt = db.prepare(`
			INSERT INTO user_2fa_methods
			(method_id, user_id, method_type, label, is_primary, is_verified, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`);
		stmt.run(method_id, user_id, method_type, label, is_primary, is_verified, created_at, updated_at);
	} catch (err) {
		console.error("Error creating 2FA method:", err);
		return undefined;
	}

	return getRow<user2FaMethods>("user_2fa_methods", "method_id", method_id);
}


/**
 * Update User 2FA Method
 * @param method_id The method ID
 * @param options Partial information to update
 * @returns true if updated, false otherwise
 */
export function update2FaMethods(method_id: string, options: Partial<user2FaMethods>): boolean {
	const keys = Object.keys(options).filter(
		key => options[key as keyof user2FaMethods] !== undefined && options[key as keyof user2FaMethods] !== null
	);

	if (keys.length === 0) return false;

	const setClause = keys.map(key => `${key} = @${key}`).join(", ");
	const params: Record<string, unknown> = { method_id };

	for (const key of keys) {
		if (key === "is_verified" || key === "is_primary") {
			// accept truthy/0/1
			const val = options[key as keyof user2FaMethods];
			params[key] = val ? 1 : 0;
		} else {
			params[key] = options[key as keyof user2FaMethods];
		}
	}

	const stmt = db.prepare(`
		UPDATE user_2fa_methods
		SET ${setClause}
		WHERE method_id = @method_id
	`);
	const result = stmt.run(params);
	return (result.changes > 0);
}

/**
 * Delete 2FA Method by ID
 * @param method_id The method ID
 * @returns true if deleted, false otherwise
 */
export function delete2FaMethods(method_id: string): boolean {
	const stmt = db.prepare("DELETE FROM user_2fa_methods WHERE method_id = ?");
	const result = stmt.run(method_id);
	return (result.changes > 0);
}

/**
 * Set primary 2FA method for a user
 * @param user_id The user ID
 * @param method_id The method ID to set as primary
 * @returns true if updated, false otherwise
 */
export function setPrimary2FaMethod(user_id: string, method_id: string): boolean {
	const unsetStmt = db.prepare("UPDATE user_2fa_methods SET is_primary = 0 WHERE user_id = ? AND is_primary = 1");
	unsetStmt.run(user_id);
	const setStmt = db.prepare("UPDATE user_2fa_methods SET is_primary = 1 WHERE method_id = ? AND user_id = ?");
	const result = setStmt.run(method_id, user_id);
	return (result.changes > 0);
}

/**
 * Verify 2FA Method
 * @param method_id The method ID
 * @returns true if verified, false otherwise
 */
export function verify2FaMethod(method_id: string): boolean {
	const stmt = db.prepare("UPDATE user_2fa_methods SET is_verified = 1 WHERE method_id = ?");
	const result = stmt.run(method_id);
	return (result.changes > 0);
}

/**
 * Get all 2FA methods for a user by type
 * @param user_id The user UUID
 * @param method_type The method type (0 = Email, 1 = Authenticator App, 2 = Backup Codes)
 * @returns An array of User 2FA Methods
 */
export function getAllMethodsByUserIdByType(user_id: string, method_type: 0 | 1 | 2): user2FaMethods[] {
	const stmt = db.prepare("SELECT * FROM user_2fa_methods WHERE user_id = ? AND method_type = ?");
	return stmt.all(user_id, method_type) as user2FaMethods[];
};

/**
 * Batch update multiple 2FA methods.
 * @param updates Array of user2FaMethods objects WITH updated fields already applied
 * @returns true if all updates succeeded, false otherwise
 */
export function updateBatch2FaMethods(updates: user2FaMethods[]): boolean {
	if (!updates || updates.length === 0) {
		return true;
	}

	const allowed = new Set([
		"label",
		"is_verified",
		"is_primary",
		"updated_at"
	]);

	const updateStmt = db.prepare(`
		UPDATE user_2fa_methods
		SET label = @label,
		    is_verified = @is_verified,
		    is_primary = @is_primary,
		    updated_at = @updated_at
		WHERE method_id = @method_id
	`);

	const transaction = db.transaction((rows: user2FaMethods[]) => {
		for (const row of rows) {
			const params: Record<string, unknown> = { method_id: row.method_id };

			for (const key of allowed) {
				if (key === "is_verified" || key === "is_primary")
					params[key] = row[key] ? 1 : 0;
				else
					params[key] = row[key as keyof user2FaMethods];
			}

			updateStmt.run(params);
		}
	});

	try {
		transaction(updates);
		return true;
	} catch (err) {
		console.error("Error while updating 2FA methods:", err);
		return false;
	}
}