export const connectionSchema = {
    summary: "Get a user's connection status",
    description: "Returns whether the specified user is online (in a game or recent activity) or offline.",
    tags: ["Users: Connection"],
    params: {
        type: 'object',
        properties: {
            userId: { type: 'string', description: 'Target user id' }
        },
        required: ['userId']
    },
    response: {
        400: {
            description: "Bad request - invalid user id",
            type: "object",
            properties: { message: { type: "string", example: "Invalid user id" } }
        },
        200: {
            description: "Connection status",
            type: "object",
            properties: {
                status: { type: "string", enum: ["online", "offline"], example: "online" },
                detail: { type: "string", example: "in_game" },
                lastRequestAt: { type: "number", description: "Unix timestamp (seconds) of last request", nullable: true }
            }
        },
        401: {
            description: "Unauthorized - missing or invalid session",
            type: "object",
            properties: { message: { type: "string", example: "Unauthorized" } }
        },
        500: {
            description: "Internal server error",
            type: "object",
            properties: { message: { type: "string", example: "Internal Server Error" } }
        }
    }
};
