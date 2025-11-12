export const getTwoFaMethodsSchema = {
	summary: "Get verified Two-Factor Authentication methods for the current user",
	description:
		"Retrieves all 2FA methods that have been set up for the authenticated user. Each method includes its type, label, if it is verified, when it was created, and whether it is the primary method.",
	tags: ["Users: 2FA"],
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
							is_verified: {
								type: "boolean",
								description: "Indicates whether this 2FA method has been verified",
							},
							created_at: {
								type: "integer",
								description: "Timestamp (ms since epoch) when the 2FA method was created",
							}
						},
						required: ["method_type", "label", "is_primary", "is_verified", "created_at"],
					},
				},
			},
		},
		404: {
			description: "No 2FA methods found for the user",
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

/*	=======================================================
		Create Two-Factor Authentication Methods Schema
	=======================================================	*/
export const createTwoFaMethodsSchema = {
	summary: "Create new Two-Factor Authentication methods",
	description:
		"Allows the authenticated user to create new 2FA methods (Email OTP, Authenticator App TOTP, or Backup Codes). " +
		"Each method can include custom parameters, such as email address, TOTP algorithm, or duration.",
	tags: ["Users: 2FA"],
	body: {
		type: "object",
		required: ["methods"],
		properties: {
			methods: {
				type: "array",
				description: "List of 2FA methods to create.",
				items: {
					type: "object",
					properties: {
						methodType: {
							type: "integer",
							enum: [0, 1, 2],
							description: "Type of 2FA method: 0 = Email OTP, 1 = TOTP (authenticator app), 2 = Backup codes",
						},
						label: {
							type: "string",
							description: "Optional label or name for this 2FA method (3–100 chars)",
							example: "Personal Email",
						},
						params: {
							type: "object",
							description: "Additional parameters depending on the method type.",
							properties: {
								email: { type: "string", format: "email", description: "Email address for Email OTP." },
								duration: {
									type: "integer",
									minimum: 15,
									maximum: 60,
									description: "TOTP step duration (seconds). Default: 30.",
									example: 30,
								},
								algorithm: {
									type: "string",
									enum: ["sha1", "sha256", "sha512"],
									description: "TOTP hash algorithm. Default: sha1.",
									example: "sha1",
								},
								digits: {
									type: "integer",
									enum: [6, 8],
									description: "Number of digits in TOTP code. Default: 6.",
									example: 6,
								},
							},
						},
					},
					required: ["methodType"],
				},
			},
		},
	},
	response: {
		201: {
			description: "2FA methods successfully created",
			type: "object",
			properties: {
				results: {
					type: "array",
					items: {
						type: "object",
						properties: {
							methodType: {
								type: "integer",
								description: "Type of 2FA method (0 = Email OTP, 1 = TOTP, 2 = Backup codes)",
							},
							label: { type: "string", description: "Label for the method" },
							methodId: { type: "string", description: "UUID of the created 2FA method" },
							success: { type: "boolean", description: "Whether the creation was successful" },
							message: { type: "string", description: "Result message" },
							params: {
								type: "object",
								nullable: true,
								description: "Additional info depending on method type",
								properties: {
									// For TOTP:
									otpauthUrl: { type: "string", description: "otpauth:// URL for the TOTP setup" },
									qrMatrix: {
										type: "array",
										items: { type: "string" },
										description: "QR code matrix for terminal display",
									},
									// For Backup codes:
									codes: {
										type: "array",
										items: { type: "string" },
										description: "List of plaintext backup codes",
									},
								},
							},
						},
					},
				},
			},
		},
		400: {
			description: "Invalid request data",
			type: "object",
			properties: {
				message: { type: "string", example: "No 2FA methods provided." },
			},
		},
		401: {
			description: "Unauthorized — user not authenticated",
			type: "object",
			properties: {
				message: { type: "string", example: "Authentication required." },
			},
		},
		404: {
			description: "User not found",
			type: "object",
			properties: {
				message: { type: "string", example: "User not found." },
			},
		},
		500: {
			description: "Internal server error",
			type: "object",
			properties: {
				message: { type: "string", example: "Database error while creating subtype: ..." },
			},
		},
	},
};

/*	=======================================================
		Send 2FA Verification Email Schema
	=======================================================	*/

export const emailSendSchema = {
	summary: "Send a verification email",
	description:
		"Sends a 2fa verification email to the user.",
	tags: ["Users: 2FA - Email"],
	body: {
		type: "object",
		required: ["email"],
		properties: {
			email: {
				type: "string",
				format: "email",
				description: "User email address"
			},
		},
	},
	response: {
		202: {
			description: "Email sent successfully",
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
			description: "Too many registration attempts",
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

/*	=======================================================
		Validate TOTP Code Schema
	=======================================================	*/
export const validateTotpSchema = {
	summary: "Validate a TOTP code for a 2FA method",
	description:
		"Validates a Time-based One-Time Password (TOTP) code provided by the user for a specific 2FA method.",
	tags: ["Users: 2FA - TOTP"],
	body: {
		type: "object",
		required: ["twofa_uuid", "totp_code"],
		properties: {
			twofa_uuid: {
				type: "string",
				description: "The UUID of the 2FA method to validate against",
			},
			totp_code: {
				type: "string",
				description: "The TOTP code provided by the user",
			},
		},
	},
	response: {
		200: {
			description: "TOTP code validated successfully",
			type: "object",
			properties: {
				message: { type: "string", example: "TOTP code validated successfully." },
			},
		},
		400: {
			description: "Bad request — missing or invalid fields",
			type: "object",
			properties: { message: { type: "string" } },
		},
		401: {
			description: "Unauthorized — invalid TOTP code",
			type: "object",
			properties: { message: { type: "string", example: "Invalid TOTP code." } },
		},
		404: {
			description: "2FA method not found",
			type: "object",
			properties: { message: { type: "string", example: "TOTP method not found." } },
		},
		429: {
			description: "Too many attempts — rate limit exceeded",
			type: "object",
			properties: { message: { type: "string" } },
		},
		500: {
			description: "Internal server error",
			type: "object",
			properties: { message: { type: "string", example: "Internal server error." } },
		},
	},
};