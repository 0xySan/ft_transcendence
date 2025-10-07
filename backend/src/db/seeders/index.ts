/*
 * This file handles database initialization and seeding.
 * It ensures the SQLite database exists, executes the initial SQL schema,
 * and runs all seeder functions (e.g., countries) to populate initial data.
 */

import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

// --- Type alias for better-sqlite3 Database ---
type SqliteDatabase = Database.Database;

// Import seeder functions
import { populateCountries } from "./countries.js";




// --- Main function to initialize DB and run seeders ---
export function initializeDatabase(): SqliteDatabase {
	// --- Define paths ---
	const dataDir = path.join(process.cwd(), "data");          // Directory to store the DB
	const dbFile = path.join(dataDir, "database.sqlite");     // SQLite database file
	const initSqlFile = path.join("sql", "init.sql");         // SQL file for schema initialization

	// --- Ensure data directory exists ---
	if (!fs.existsSync(dataDir)) {
		fs.mkdirSync(dataDir, { recursive: true });
		console.log(`Created data directory at ${dataDir}`);
	}

	// --- Check if the database already exists ---
	const dbExists = fs.existsSync(dbFile);

	// --- Open the SQLite database ---
	const db: SqliteDatabase = new Database(dbFile);
	console.log(`Opened SQLite DB at ${dbFile}`);

	// --- Execute init.sql only if the DB was just created ---
	if (!dbExists) {
		if (fs.existsSync(initSqlFile)) {
			const sql = fs.readFileSync(initSqlFile, "utf8");
			if (sql.trim().length > 0) {
				db.exec(sql);
				console.log(`Executed init SQL from ${initSqlFile}`);
			}
		}

		// --- Run seeder functions to populate initial data ---
		try {
			populateCountries(db);
			console.log("Populated countries table from countries.js");
		} catch (err) {
			console.error(`Failed to populate countries table: ${(err as Error).message}`);
			process.exit(1);
		}
	} else {
		console.log("Database already exists, skipping init.sql execution and seeders");
	}

	return db;
}

export { populateCountries };
