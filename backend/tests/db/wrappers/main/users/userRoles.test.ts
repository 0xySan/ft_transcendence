/**
 * @file userRoles.test.ts
 * @description Unit tests for the userRoles database wrapper.
 * 
 * This suite verifies:
 *  - presence of default roles,
 *  - insertion of new roles,
 *  - prevention of duplicates,
 *  - alphabetical listing.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { getRoleById, getRoleByName, createRole, getAllRoles } from "../../../../../src/db/wrappers/main/users/userRoles.js";

describe("UserRoles wrapper", () => {
	let defaultRoles: string[] = ["user", "moderator", "admin", "banned", "unverified"];

	// --- Tests for presence of default roles --------------------------------
	it("should find all default roles by name", () => {
		defaultRoles.forEach(name => {
			const role = getRoleByName(name);
			expect(role).toBeDefined();
			expect(role?.role_name).toBe(name);
		});
	});

	it("should list all roles sorted alphabetically", () => {
		const roles = getAllRoles();
		expect(roles.length).toBeGreaterThanOrEqual(defaultRoles.length);

		const names = roles.map(r => r.role_name);
		const isSorted = names.every((v, i, arr) => !i || arr[i - 1] <= v);
		expect(isSorted).toBe(true);
	});

	// --- Tests for creation ------------------------------------------------
	it("should create a new role successfully", () => {
		const role = createRole("developer");
		expect(role).toBeDefined();
		expect(role?.role_name).toBe("developer");
	});

	it("should return existing role if already present", () => {
		const existing = createRole("user");
		expect(existing).toBeDefined();
		expect(existing?.role_name).toBe("user");
	});

	it("should not create invalid roles (name too long)", () => {
		const tooLong = "A".repeat(100);
		const result = createRole(tooLong);
		expect(result).toBeUndefined();
	});

	// --- Tests retrieval by ID ---------------------------------------------
	it("should return a role by ID", () => {
		const role = getRoleByName("admin");
		const byId = role ? getRoleById(role.role_id) : undefined;
		expect(byId).toBeDefined();
		expect(byId?.role_name).toBe("admin");
	});

	it("should return undefined for non-existing role ID", () => {
		const result = getRoleById(999999);
		expect(result).toBeUndefined();
	});
});
