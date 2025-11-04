export const new2faRoutesSchema = {
	summary: 'Generate new 2FA secret',
	description: 'Generates a new 2FA secret for the authenticated user and returns the QR code URL and secret key.',
	tags: ['2FA'],
	body: {
		type: 'object',
		properties: {
			email: { type: 'string', format: 'email' },
			username: { type: 'string', minLength: 3, maxLength: 20 }
		},
		required: ["email", "username"]
	},
	response: {
		200: {
			description: '2FA secret generated successfully',
			type: 'object',
			properties: {
				otpauth_url: { type: 'string', description: 'URL for QR code generation' },
				secret: { type: 'string', description: 'Base32 encoded secret key' }
			},
			example: {
				otpauth_url: 'otpauth://totp/YourApp:username?secret=JBSWY3DPEHPK3PXP&issuer=YourApp',
				secret: 'JBSWY3DPEHPK3PXP'
			}
		},
		401: {
			description: 'Unauthorized - user not authenticated',
			type: 'object',
			properties: {
				error: { type: 'string' }
			},
			example: { error: 'Unauthorized' }
		},
		500: {
			description: 'Internal server error during 2FA generation',
			type: 'object',
			properties: {
				error: { type: 'string' }
			},
			example: { error: 'Failed to generate 2FA secret' }
		}
	}
};