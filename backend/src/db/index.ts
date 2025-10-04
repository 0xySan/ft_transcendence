// db/index.ts
/*
 * Central export for database instance and DB helpers.
 * Initializes the database and exposes functions to manipulate it.
 */

import { initializeDatabase } from "./seeders/index.js"; // init + seeders

// --- Initialize the database ---
const db = initializeDatabase();

// --- Export the database and all helpers ---
export { db };
export * from "./wrappers/index.js";
