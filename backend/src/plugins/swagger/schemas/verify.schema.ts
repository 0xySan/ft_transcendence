export const verifySchema = {
	summary: "Verify user account email",
	description: "Verifies a user's email address using a verification token sent to their email. Responses are uniform to prevent user enumeration and timing attacks.",
	tags: ["Users: Accounts"],
	querystring: {
		type: "object",
		required: ["token", "user"],
		properties: {
			token: {
				type: "string",
				description: "Email verification token sent to the user",
			},
			user: {
				type: "string",
				description: "User ID associated with the verification token",
			},
		},
	},
	response: {
		202: {
			description: "The verification is being processed",
			type: "object",
			properties: {
				message: { type: "string", example: "If the verification is valid, your email will be verified shortly." },
			},
		},
		429: {
			description: "Too many verification attempts from this IP",
			type: "object",
			properties: {
				message: { type: "string", example: "Too many verification attempts. Try again later." },
			},
		},
		400: {
			description: "Invalid request parameters",
			type: "string",
			example: "Invalid user id",
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
