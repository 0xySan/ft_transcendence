export const loginAccountSchema = {
	summary: "Login a user account",
	description:
		"Logs in a user account with email/password or OAuth credentials.",
	tags: ["Users: Accounts"],
	body: {
		type: "object",
		properties: {
			email: {
				type: "string",
				format: "email",
				description: "User email address",
			},
			password: {
				type: "string",
				description: "User password (8–64 chars)",
			},
			username: {
				type: "string",
				description: "Unique username (3–20 chars, letters, numbers, underscores)",
			},
			rememberMe: {
				type: "boolean",
				default: false,
				description: "Whether to remember the user for future sessions",
			},
		},
		allOf: [
			{
				anyOf: [
					{ required: ["email"] },
					{ required: ["username"] },
				],
			},
			{ required: ["password"] },
		],
	},
	response: {
		202: {
			description: "Login accepted (requires 2FA verification).",
			type: "object",
			properties: {
				message: { type: "string" },
			},
		},
		400: {
			description: "Bad request — missing or invalid fields",
			type: "object",
			properties: { message: { type: "string" } },
		},
		429: {
			description: "Too many login attempts",
			type: "object",
			properties: { message: { type: "string" } },
		},
		500: {
			description: "Internal server error",
			type: "object",
			properties: { message: { type: "string" } },
		},
	},
};
