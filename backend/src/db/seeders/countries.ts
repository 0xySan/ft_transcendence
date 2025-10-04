/*
 * Populate the 'countries' table in the database with country codes, names, and SVG flag paths.
 * Uses the 'svg-country-flags' module for SVG files and 'i18n-iso-countries' for country names.
 */

import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json" with { type: "json" };
import { fileURLToPath, pathToFileURL } from "url";

// --- ESM workaround for __dirname ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Register English locale
countries.registerLocale(enLocale);

// --- Function to populate countries table ---
export function populateCountries(db: Database.Database) {
	// --- Resolve svg-country-flags module path in ESM ---
	const pkgUrl = new URL("../../node_modules/svg-country-flags/package.json", import.meta.url);
	const pkgPath = fileURLToPath(pkgUrl);
	const moduleDir = path.dirname(pkgPath);
	const svgCountryFlagsPath = path.join(moduleDir, "svg");

	// Read SVG files
	const files = fs.readdirSync(svgCountryFlagsPath).filter(f => f.endsWith(".svg"));

	// Prepare insert statement
	const insertStmt = db.prepare(`
		INSERT OR IGNORE INTO countries (country_code, country_name, flag_svg_path)
		VALUES (?, ?, ?)
	`);

	// Custom entries
	const customMap: Record<string, string> = {
		BZH: "Brittany"
	};

	console.log("Files found:", files.length, files.slice(0,5));

	// Insert ISO countries
	for (const file of files) {
	  const code = path.basename(file, ".svg").toUpperCase();
	  const name = countries.isValid(code) ? countries.getName(code, "en") : code;
	  const svgPath = `/resources/imgs/svg/flags/${file}`;
	  insertStmt.run(code, name, svgPath);
	}


	// Insert custom
	for (const [code, name] of Object.entries(customMap)) {
		const svgFile = `${code.toLowerCase()}.svg`;
		const svgPath = `/resources/imgs/svg/flags/${svgFile}`;
		insertStmt.run(code, name, svgPath);
	}

	console.log(
		`Inserted ${files.filter(f => countries.isValid(path.basename(f, ".svg").toUpperCase())).length + Object.keys(customMap).length} countries and custom entries.`
	);
}
