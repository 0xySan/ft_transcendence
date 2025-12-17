export const oauthUnlinkSchema = {
	summary: 'Unlink OAuth account',
	description: 'Unlinks an OAuth account from the authenticated user.',
	tags: ['OAuth'],
	params: {
		type: 'object',
		required: ['provider'],
		properties: {
			provider: {
				type: 'string',
				description: 'OAuth provider to unlink',
				enum: ['discord', 'forty-two', 'github', 'google'],
				example: 'discord',
			}
		}
	},
	response: {
		200: {
			description: 'Account successfully unlinked',
			type: 'object',
			properties: {
				message: { type: 'string', example: 'Account unlinked successfully' }
			}
		},
		400: {
			description: 'Invalid request or missing parameters',
			type: 'object',
			properties: {
				error: { type: 'string', example: 'Provider param is required' }
			}
		},
		401: {
			description: 'Unauthorized — no or invalid session',
			type: 'object',
			properties: {
				message: { type: 'string', example: 'Unauthorized: No session token' }
			}
		},
		404: {
			description: 'OAuth account not found for the user',
			type: 'object',
			properties: {
				error: { type: 'string', example: 'Account not found' }
			}
		},
		500: {
			description: 'Internal server error',
			type: 'object',
			properties: {
				error: { type: 'string', example: 'Failed to unlink account' }
			}
		}
	}
};
