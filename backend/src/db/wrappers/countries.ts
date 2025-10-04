/**
 * Wrapper functions for interacting with the `countries` table.
 * Provides retrieval, creation, and listing utilities.
 */

import { db, insertRow, getRow } from "../index.js";

/** --- Types --- */
export interface Country {
	id: number;
	country_code: string;
	country_name: string;
	flag_svg_path: string;
}

/**
 * Retrieve a country by its ID.
 * @param id - The primary key of the country
 * @returns The country object if found, otherwise undefined
 */
export function getCountryById(id: number): Country | undefined {
	return getRow<Country>("countries", "id", id);
}

/**
 * Retrieve a country by its ISO code.
 * @param code - The 2–3 letter ISO code of the country
 * @returns The country object if found, otherwise undefined
 */
export function getCountryByCode(code: string): Country | undefined {
	return getRow<Country>("countries", "country_code", code.toUpperCase());
}

/**
 * Retrieve a country by its name.
 * @param name - The full country name
 * @returns The country object if found, otherwise undefined
 */
export function getCountryByName(name: string): Country | undefined {
	return getRow<Country>("countries", "country_name", name);
}

/**
 * Create a new country if it doesn't exist.
 * Default values will be applied for missing fields.
 * Uses the generic insertRow wrapper to insert and fetch the country.
 *
 * @param options - Partial country object with country_code, country_name, and/or flag_svg_path
 * @returns The newly created or existing country object, or undefined if insertion failed
 */
export function createCountry(options: Partial<Country>): Country | undefined {
	const code = (options.country_code || "UNK").toUpperCase();
	const name = options.country_name || "Unknown";
	const flag = options.flag_svg_path || `/resources/imgs/svg/flags/${code.toLowerCase()}.svg`;

	return insertRow<Country>("countries", {
		country_code: code,
		country_name: name,
		flag_svg_path: flag,
	});
}

/**
 * List all countries in alphabetical order by name.
 * @returns An array of all country objects
 */
export function getAllCountries(): Country[] {
	const stmt = db.prepare(`
		SELECT * FROM countries
		ORDER BY country_name
	`);
	return stmt.all() as Country[];
}
