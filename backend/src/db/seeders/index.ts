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
import { seedOAuthProviders } from "./oauthProvider.js";

function isTestEnv(): boolean {
  // Type guard for import.meta.vitest
  const hasVitest = typeof (import.meta as any).vitest !== "undefined";
  return hasVitest || process.env.NODE_ENV === "test";
}

// --- Main function to initialize DB and run seeders ---
export function initializeDatabase(): SqliteDatabase {
	// --- Define paths ---
	const dataDir = path.join(process.cwd(), "data");          // Directory to store the DB
	const userDataDir = path.join(process.cwd(), "userData/imgs"); // user data directory
	const dbFile = path.join(dataDir, "database.sqlite");     // SQLite database file
	const initSqlFile = path.join("sql", "init.sql");         // SQL file for schema initialization
	const authInitSqlFile = path.join("sql", "authentication.sql"); // SQL file for auth schema (if needed)

	let dbExists = false;
	let db: SqliteDatabase;
	const log = console.log;

	if (isTestEnv()) {
		// In test environment, use an in-memory database
		log("Running in test environment, using in-memory SQLite DB");
		db = new Database(":memory:");
		dbExists = false; // Always treat as new DB
		console.log = () => {}; // Silence logs in test env
	} else {
		// --- Ensure data directory exists ---
		if (!fs.existsSync(dataDir)) {
			fs.mkdirSync(dataDir, { recursive: true });
			log(`Created data directory at ${dataDir}`);
		}

		if (!fs.existsSync(userDataDir)) {
			fs.mkdirSync(userDataDir, { recursive: true });
			log(`Created user data directory at ${userDataDir}`);
		}

		// --- Check if the database already exists ---
		dbExists = fs.existsSync(dbFile);

		// --- Open the SQLite database ---
		db = new Database(dbFile);
		log(`Opened SQLite DB at ${dbFile}`);
	}

	// --- Execute init.sql only if the DB was just created ---
	if (!dbExists) {
		if (fs.existsSync(initSqlFile)) {
			const sql = fs.readFileSync(initSqlFile, "utf8");
			if (sql.trim().length > 0) {
				db.exec(sql);
				console.log(`Executed init SQL from ${initSqlFile}`);
			}
		}

		if (fs.existsSync(authInitSqlFile)) {
			const authSql = fs.readFileSync(authInitSqlFile, "utf8");
			if (authSql.trim().length > 0) {
				db.exec(authSql);
				console.log(`Executed authentication SQL from ${authInitSqlFile}`);
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

		if (!isTestEnv()) {
			try {
				seedOAuthProviders(db);
			} catch (err) {
				console.error(`Failed to seed OAuth providers exiting: ${(err as Error).message}`);
				process.exit(1);
			}
		}
	} else {
		log("Database already exists, skipping init.sql execution and seeders");
	}
	console.log = log; // Restore original console.log if it was overridden

	return db;
}

export { populateCountries };
