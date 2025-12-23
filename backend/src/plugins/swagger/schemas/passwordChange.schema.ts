export const passwordChangeSchema = {
    summary: "Change password for authenticated user",
    description: "Allows an authenticated user to change their password. If the user has 2FA configured and verified, a 2FA method id and token are required.",
    tags: ["Users: Accounts"],
    body: {
        type: "object",
        required: ["old_password", "new_password"],
        properties: {
            old_password: { type: "string", description: "Current password", example: "oldSecret123" },
            new_password: { type: "string", description: "New password (8-64 chars)", example: "N3wPassw0rd!" },
            twofa_method_id: { type: "string", description: "UUID of chosen 2FA method (required if 2FA is enabled)" , nullable: true},
            twofa_token: { type: "string", description: "2FA token or code for the chosen method", nullable: true }
        }
    },
    response: {
        200: { description: "Password updated", type: "object", properties: { message: { type: "string" } } },
        400: { description: "Bad request / validation error", type: "object", properties: { message: { type: "string" } } },
        401: { description: "Unauthorized or invalid credentials/2FA", type: "object", properties: { message: { type: "string" } } },
        404: { description: "2FA method not found", type: "object", properties: { message: { type: "string" } } },
        500: { description: "Internal server error", type: "object", properties: { message: { type: "string" } } }
    }
};
