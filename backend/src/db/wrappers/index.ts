/*
 * Central export for all DB wrapper functions
 */

import { db } from "../index.js";

/**
 * Generic insert function.
 * Safely inserts a row into the specified table.
 * Returns the inserted row, an existing row (if UNIQUE constraint prevents insertion),
 * or undefined in case of any error.
 *
 * @template T - Type of the row expected to be returned
 * @param table - Table name to insert into
 * @param data - Object where keys are column names and values are column values
 * @returns The inserted row, existing row, or undefined if failed
 */
export function insertRow<T>(table: string, data: Record<string, unknown>): T | undefined {
	try {
		const columns = Object.keys(data).join(", ");
		const placeholders = Object.keys(data).map(() => "?").join(", ");
		const values = Object.values(data);

		console.log("DEBUG: BEFORE RUN COMMAND = " + table);
		console.log(columns)
		console.log(placeholders)
		const stmt = db.prepare(`INSERT INTO ${table} (${columns}) VALUES (${placeholders})`);
		const info = stmt.run(...values);
		console.log("DEBUG: AFTER RUN COMMAND = " + table);

		// Fetch the newly inserted row by rowid
		const row = db.prepare(`SELECT * FROM ${table} WHERE rowid = ?`).get(info.lastInsertRowid);
		return row as T;
	} catch (err) {
		// Any error (constraint, invalid data, etc.) returns undefined
		console.error(`Failed to insert into ${table}:`, (err as Error).message);
		return undefined;
	}
}

/**
 * Generic getter function.
 * @param table - Table name
 * @param column - Column name to filter by
 * @param value - Value to search
 * @returns The row object if found, otherwise undefined
 */
export function getRow<T>(table: string, column: string, value: unknown): T | undefined {
	try {
		const stmt = db.prepare(`SELECT * FROM ${table} WHERE ${column} = ?`);
		return stmt.get(value) as T | undefined;
	} catch (err) {
		console.error(`Error in getRow for ${table}.${column}:`, (err as Error).message);
		return undefined;
	}
}

export * from "./main/countries.js";
export * from "./main/gameParticipants.js";
export * from "./main/games.js";
export * from "./main/userProfiles.js";
export * from "./main/userRoles.js";
export * from "./main/users.js";
export * from "./main/userStats.js";

export * from "./auth/oauthProviders.js";
