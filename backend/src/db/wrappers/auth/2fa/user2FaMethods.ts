import { db, getRow } from "../../../index.js";
import { v7 as uuidv7 } from "uuid";

export interface user2FaMethods {
	method_id:		string;
	user_id:		string;
	method_type:	number;
	label:			string | null;
	is_primary:		boolean;
	is_verified:	boolean;
	created_at:		number;
	updated_at:		number;
}

export function getUser2FaMethodsById(id: string): user2FaMethods | undefined {
	return (getRow<user2FaMethods>("user_2fa_methods", "method_id", id));
}

export function getUser2FaMethodsByUserId(user_id: string): user2FaMethods[] {
	const stmt = db.prepare("SELECT * FROM user_2fa_methods WHERE user_id = ?");
	return stmt.all(user_id) as user2FaMethods[];
}

export function getPrimary2FaMethodByUserId(user_id: string): user2FaMethods | undefined {
	const stmt = db.prepare("SELECT * FROM user_2fa_methods WHERE user_id = ? AND is_primary = 1");
	return stmt.get(user_id) as user2FaMethods | undefined;
}

/**
 * Robust create: validate required fields, insert directly, return inserted row.
 */
export function create2FaMethods(options: Partial<user2FaMethods>): user2FaMethods | undefined {
	// required: user_id:string, method_type:number, created_at:number, updated_at:number
	if (typeof options.user_id !== "string") return undefined;
	if (typeof options.method_type !== "number") return undefined;
	if (typeof options.created_at !== "number" || typeof options.updated_at !== "number") return undefined;

	const method_id = (typeof options.method_id === "string" && options.method_id.length > 0) ? options.method_id : uuidv7();
	const user_id = options.user_id;
	const method_type = options.method_type;
	const label = (typeof options.label === "string") ? options.label : null;
	const is_primary = (options.is_primary ? 1 : 0);
	const is_verified = (options.is_verified ? 1 : 0);
	const created_at = options.created_at;
	const updated_at = options.updated_at;

	try {
		const stmt = db.prepare(`
			INSERT INTO user_2fa_methods
			(method_id, user_id, method_type, label, is_primary, is_verified, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`);
		stmt.run(method_id, user_id, method_type, label, is_primary, is_verified, created_at, updated_at);
	} catch (err) {
		// insertion failed (constraint, type mismatch...) -> return undefined for tests
		return undefined;
	}

	return getRow<user2FaMethods>("user_2fa_methods", "method_id", method_id);
}

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

export function delete2FaMethods(method_id: string): boolean {
	const stmt = db.prepare("DELETE FROM user_2fa_methods WHERE method_id = ?");
	const result = stmt.run(method_id);
	return (result.changes > 0);
}

export function setPrimary2FaMethod(user_id: string, method_id: string): boolean {
	const unsetStmt = db.prepare("UPDATE user_2fa_methods SET is_primary = 0 WHERE user_id = ? AND is_primary = 1");
	unsetStmt.run(user_id);
	const setStmt = db.prepare("UPDATE user_2fa_methods SET is_primary = 1 WHERE method_id = ? AND user_id = ?");
	const result = setStmt.run(method_id, user_id);
	return (result.changes > 0);
}

export function verify2FaMethod(method_id: string): boolean {
	const stmt = db.prepare("UPDATE user_2fa_methods SET is_verified = 1 WHERE method_id = ?");
	const result = stmt.run(method_id);
	return (result.changes > 0);
}