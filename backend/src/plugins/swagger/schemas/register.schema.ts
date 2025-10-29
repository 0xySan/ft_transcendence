export const registerAccountSchema = {
	summary: "Create a new user account",
	description:
		"Registers a new user account with either email/password or OAuth credentials. Also creates a user profile and sends a verification email.",
	tags: ["Users: Accounts"],
	body: {
		type: "object",
		required: ["email", "username"],
		properties: {
			email: {
				type: "string",
				format: "email",
				description: "User email address",
			},
			password: {
				type: "string",
				description:
					"User password (8–40 chars, must include uppercase, lowercase, number, special character)",
			},
			username: {
				type: "string",
				description: "Unique username (3–20 chars, letters, numbers, underscores)",
			},
			display_name: {
				type: "string",
				description: "Public display name (optional)",
			},
			pfp: {
				type: "string",
				description: "Optional avatar URL or path",
			},
			oauth: {
				type: "object",
				description: "Optional OAuth account data (used when registering via an external provider)",
				properties: {
					provider_name: { type: "string", description: "OAuth provider name" },
					provider_user_id: { type: "string", description: "Unique provider user ID" },
					profile_json: { type: "string", description: "Raw OAuth profile JSON (optional)" },
					id_token_hash: { type: "string", description: "Hashed ID token (optional)" },
				},
			},
		},
		anyOf: [
			{
				required: ["password"], 
				description: "Password-based registration"
			},
			{
				required: ["oauth"],
				description: "OAuth-based registration"
			},
		],
	},
	response: {
		201: {
			description: "User account created successfully",
			type: "object",
			properties: {
				message: { type: "string" },
				user: {
					type: "object",
					properties: {
						user_id: { type: "number" },
						email: { type: "string" },
						role_id: { type: "number" },
					},
				},
			},
		},
		400: {
			description: "Bad request — missing or invalid fields",
			type: "object",
			properties: { error: { type: "string" } },
		},
		409: {
			description: "Conflict — email, username or OAuth already registered",
			type: "object",
			properties: { error: { type: "string" } },
		},
		500: {
			description: "Internal server error",
			type: "object",
			properties: { error: { type: "string" } },
		},
	},
};