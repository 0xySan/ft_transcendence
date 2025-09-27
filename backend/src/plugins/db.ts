import fp from "fastify-plugin";
import path from "path";
import fs from "fs";
import Database from "better-sqlite3";
import type { FastifyPluginAsync } from "fastify";

// Type alias for the better-sqlite3 Database instance
type SqliteDatabase = Database.Database;

const dbPlugin: FastifyPluginAsync = fp(async (app) => {
  // --- Paths ---
  const dataDir = path.join(process.cwd(), "data");           // db directory
  const dbFile = path.join(dataDir, "database.sqlite");      // SQLite file
  const initSqlFile = path.join("sql", "init.sql");          // initialization script

  // --- Ensure data directory exists ---
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    app.log.info(`Created data directory at ${dataDir}`);
  }

  // --- Check if DB file exists before opening ---
  const dbExists = fs.existsSync(dbFile);

  // --- Open (or create) the SQLite DB ---
  let db: SqliteDatabase;
  try {
    db = new Database(dbFile);
    app.log.info(`Opened SQLite DB at ${dbFile}`);
  } catch (err) {
    app.log.error(`Failed to open SQLite DB at ${dbFile}: ${(err as Error).message}`);
    throw err;
  }

  // --- Execute init.sql only if DB was just created ---
  if (!dbExists) {
    if (fs.existsSync(initSqlFile)) {
      try {
        const sql = fs.readFileSync(initSqlFile, "utf8");
        if (sql.trim().length > 0) {
          db.exec(sql);
          app.log.info(`Executed init SQL from ${initSqlFile}`);
        }
      } catch (err) {
        app.log.error(`Failed to execute init.sql: ${(err as Error).message}`);
        throw err; // stop server if DB initialization fails
      }
    } else {
      app.log.info(`No init.sql found at ${initSqlFile} (skipping schema init)`);
    }
  } else {
    app.log.info("Database already exists, skipping init.sql execution");
  }

  // --- Decorate Fastify instance with db ---
  app.decorate("db", db);

  // --- Close DB on server close ---
  app.addHook("onClose", async (server) => {
    try {
      server.db.close();
      app.log.info("Closed SQLite database");
    } catch (err) {
      app.log.warn("Error closing SQLite DB: " + (err as Error).message);
    }
  });
});

// --- TypeScript augmentation for app.db ---
declare module "fastify" {
  export interface FastifyInstance {
    db: SqliteDatabase;
  }
}

export default dbPlugin;
