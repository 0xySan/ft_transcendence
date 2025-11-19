export const resetPasswordGetSchema = {
  summary: 'Request a password reset link',
  description: 'This route initiates a password reset process by sending a verification email to the user.',
  tags: ['Password Reset'],
  querystring: {
    type: 'object',
    properties: {
      email: { 
        type: 'string', 
        description: 'The email address of the user requesting a password reset.' 
      }
    },
    required: ['email']
  },
  response: {
    202: {
      description: 'Request accepted. If the request is valid, an email will be sent shortly.',
      type: 'object',
      properties: {
        success: { type: 'string' },
      },
      example: {
        success: 'If the request is valid, an email will be sent shortly.'
      }
    },
    400: {
      description: 'Bad Request. Email missing or invalid.',
      type: 'object',
      properties: {
        error: { type: 'string' }
      },
      example: {
        error: 'Email missing'
      }
    },
    500: {
      description: 'Internal error during the password reset process.',
      type: 'object',
      properties: {
        error: { type: 'string' }
      },
      example: {
        error: 'Internal error'
      }
    }
  }
};

export const resetPasswordPostSchema = {
  summary: 'Reset the user password',
  description: 'This route allows the user to reset their password by submitting a new password, confirmation, and verification token.',
  tags: ['Password Reset'],
  body: {
    type: 'object',
    required: ['new_password', 'new_password_confirm', 'token'],
    properties: {
      new_password: { 
        type: 'string', 
        description: 'The new password the user wants to set.' 
      },
      new_password_confirm: { 
        type: 'string', 
        description: 'Confirmation of the new password.' 
      },
      token: { 
        type: 'string', 
        description: 'The token sent to the user for verification.' 
      }
    },
    example: {
      new_password: 'newSecurePassword123!',
      new_password_confirm: 'newSecurePassword123!',
      token: 'abc123xyz'
    }
  },
  response: {
    202: {
      description: 'Password successfully reset.',
      type: 'object',
      properties: {
        success: { type: 'string' }
      },
      example: {
        success: 'Password has been changed'
      }
    },
    400: {
      description: 'Bad Request. Invalid or mismatched data.',
      type: 'object',
      properties: {
        error: { type: 'string' }
      },
      example: {
        error: 'Password invalid'
      }
    },
    500: {
      description: 'Internal error during the password reset process.',
      type: 'object',
      properties: {
        error: { type: 'string' }
      },
      example: {
        error: 'Internal error'
      }
    }
  }
};
