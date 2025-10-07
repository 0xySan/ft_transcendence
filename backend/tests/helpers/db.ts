import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { populateCountries } from "../../src/db/seeders/index";

let dbInstance: Database.Database | null = null;

/**
 * Initialize a fresh in-memory database for tests
 * using init.sql and seeders.
 */
export function initDb(): Database.Database {
	dbInstance = new Database(":memory:"); // in-memory DB

	// --- Load init.sql ---
	const initSqlPath = path.join(process.cwd(), "/sql/init.sql");
	if (fs.existsSync(initSqlPath)) {
		const sql = fs.readFileSync(initSqlPath, "utf8");
		if (sql.trim().length > 0) {
			dbInstance.exec(sql);
			console.log("Executed init.sql in test DB");
		}
	} else {
		throw new Error(`init.sql not found at ${initSqlPath}`);
	}

	// --- Run seeders ---
	populateCountries(dbInstance, "../../../node_modules/svg-country-flags/package.json");

	return dbInstance;
}

/**
 * Close the test database and reset state
 */
export function closeDb(): void {
	if (dbInstance) {
		dbInstance.close();
		dbInstance = null;
	}
}

/**
 * Get the current DB instance for wrappers to use
 */
export function getDb(): Database.Database {
	if (!dbInstance) {
		throw new Error("Database not initialized. Call initDb() first.");
	}
	return dbInstance;
}
