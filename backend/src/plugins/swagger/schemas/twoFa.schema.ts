export const getTwoFaMethodsSchema = {
	summary: "Get verified Two-Factor Authentication methods for the current user",
	description:
		"Retrieves all 2FA methods that have been set up and verified for the authenticated user. Each method includes its type, label, and whether it is the primary method.",
	tags: ["Users: Two-Factor Authentication"],
	response: {
		200: {
			description: "List of verified 2FA methods",
			type: "object",
			properties: {
				twoFaMethods: {
					type: "array",
					items: {
						type: "object",
						properties: {
							method_type: {
								type: "integer",
								description: "Type of 2FA method (0 = email, 1 = TOTP, etc.)",
							},
							label: {
								type: "string",
								description: "User-defined label or name for the 2FA method",
							},
							is_primary: {
								type: "boolean",
								description: "Indicates whether this method is the primary 2FA method",
							},
						},
						required: ["method_type", "label", "is_primary"],
					},
				},
			},
		},
		404: {
			description: "No verified 2FA methods found for the user",
			type: "object",
			properties: {
				message: { type: "string", example: "2Fa is not set up for your account." },
			},
		},
		401: {
			description: "Unauthorized — user not authenticated",
			type: "object",
			properties: {
				message: { type: "string", example: "Authentication required." },
			},
		},
		500: {
			description: "Internal server error",
			type: "object",
			properties: {
				message: { type: "string", example: "Internal server error." },
			},
		},
	},
};