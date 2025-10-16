/**
 * @file countries.test.ts
 * @description Unit tests for the Countries database wrapper.
 * These tests verify that all CRUD-like operations on the `countries` table
 * behave as expected, and that the seeder populated the data correctly.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
	getCountryById,
	getCountryByCode,
	getCountryByName,
	createCountry,
	getAllCountries
} from "../../../src/db/wrappers/countries.js";

/**
 * Test suite for the Countries wrapper.
 * Uses a seeded SQLite database (in-memory for tests).
 */
describe("Countries wrapper", () => {
	// --- Seeder verification ------------------------------------------------

	it("should have seeded the countries table with data", () => {
		const all = getAllCountries();
		expect(all.length).toBeGreaterThan(250); // Expecting at least 250 countries
	});

	it("should contain at least France, Japan, and United States", () => {
		const codes = ["FR", "JP", "US"];
		for (const code of codes) {
			const country = getCountryByCode(code);
			expect(country).toBeDefined();
		}
	});

	// --- Tests for retrieval by ID ------------------------------------------

	it("should return a country by ID", () => {
		const all = getAllCountries();
		const firstId = all[0]?.country_id;
		const country = getCountryById(firstId);
		expect(country).toBeDefined();
		expect(country?.country_id).toBe(firstId);
	});

	it("should return undefined if ID does not exist", () => {
		const result = getCountryById(999999);
		expect(result).toBeUndefined();
	});

	// --- Tests for retrieval by country code --------------------------------

	it("should return a country by ISO code (case-insensitive)", () => {
		const country = getCountryByCode("fr");
		expect(country).toBeDefined();
		expect(country?.country_code).toBe("FR");
	});

	it("should return undefined for an unknown ISO code", () => {
		const result = getCountryByCode("xx");
		expect(result).toBeUndefined();
	});

	// --- Tests for retrieval by name ----------------------------------------

	it("should return a country by its name", () => {
		const country = getCountryByName("France");
		expect(country?.country_code).toBe("FR");
	});

	it("should return undefined for an unknown name", () => {
		const country = getCountryByName("Moon");
		expect(country).toBeUndefined();
	});

	// --- Tests for creation -------------------------------------------------

	it("should create a new country with provided values", () => {
		const newCountry = createCountry({
			country_code: "MOO",
			country_name: "Moon",
			flag_svg_path: "/flags/moon.svg",
		});
		expect(newCountry).toBeDefined();
		expect(newCountry?.country_code).toBe("MOO");
		expect(newCountry?.country_name).toBe("Moon");
	});

	it("should do nothing and return the already existing country", () => {
		const newCountry = createCountry({
			country_code: "CA",
			country_name: "Canada",
			flag_svg_path: "/flags/ca.svg",
		});
		expect(newCountry).toBeDefined();
		expect(newCountry?.country_code).toBe("CA");
		expect(newCountry?.country_name).toBe("Canada");
	});

	it("should create a new country with default values when missing data", () => {
		const result = createCountry({});
		expect(result).toBeDefined();
		expect(result?.country_code).toBe("UNK");
		expect(result?.country_name).toBe("Unknown");
		expect(result?.flag_svg_path).toContain("/flags/unk.svg");
	});

	// --- Tests for listing --------------------------------------------------

	it("should list all countries sorted alphabetically", () => {
		const all = getAllCountries();
		const names = all.map(c => c.country_name);
		const isSorted = names.every((v, i, arr) => !i || arr[i - 1] <= v);
		expect(isSorted).toBe(true);
	});

});
