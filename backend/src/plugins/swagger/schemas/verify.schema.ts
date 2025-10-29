export const verifySchema = {
	summary: "Verify user account email",
	description: "Verifies a user's email address using a verification token sent to their email.",
	tags: ["Users: Accounts"],
	querystring: {
		type: "object",
		required: ["token", "user"],
		properties: {
			token: {
				type: "string",
				description: "Email verification token",
			},
			user: {
				type: "string",
				description: "User ID associated with the verification token",
			},
		},
	},
	response: {
		200: {
			description: "Email verified successfully",
			type: "object",
			properties: {
				message: { type: "string", example: "Email verified successfully." },
			},
		},
		400: {
			description: "Invalid request or expired token",
			type: "object",
			properties: {
				error: { type: "string", example: "Invalid user id" },
			},
		},
		404: {
			description: "Verification record not found",
			type: "object",
			properties: {
				error: { type: "string", example: "Verification record not found" },
			},
		},
		500: {
			description: "Server error during verification",
			type: "object",
			properties: {
				error: { type: "string", example: "Failed to verify email" },
			},
		},
	},
};