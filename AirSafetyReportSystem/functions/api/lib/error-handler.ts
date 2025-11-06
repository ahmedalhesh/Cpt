/**
 * Error handling utilities
 * Provides consistent error responses without exposing sensitive information
 */

export interface SafeError {
  message: string;
  statusCode: number;
  code?: string;
}

/**
 * Create a safe error response
 */
export function createSafeError(
  message: string,
  statusCode: number = 500,
  code?: string
): SafeError {
  return {
    message,
    statusCode,
    code,
  };
}

/**
 * Common error messages
 */
export const errorMessages = {
  unauthorized: 'Unauthorized',
  forbidden: 'Forbidden',
  notFound: 'Resource not found',
  badRequest: 'Invalid request',
  serverError: 'An error occurred. Please try again later.',
  rateLimited: 'Too many requests. Please try again later.',
  validationFailed: 'Invalid input data',
};

/**
 * Handle and log errors safely
 */
export function handleError(error: unknown, context?: string): SafeError {
  // Log full error details (server-side only)
  console.error(`Error in ${context || 'unknown'}:`, error);

  // Don't expose internal error details to client
  if (error instanceof Error) {
    // Check if it's a known error type
    if (error.message.includes('validation')) {
      return createSafeError(errorMessages.validationFailed, 400, 'VALIDATION_ERROR');
    }
    if (error.message.includes('unauthorized') || error.message.includes('Unauthorized')) {
      return createSafeError(errorMessages.unauthorized, 401, 'UNAUTHORIZED');
    }
    if (error.message.includes('forbidden') || error.message.includes('Forbidden')) {
      return createSafeError(errorMessages.forbidden, 403, 'FORBIDDEN');
    }
    if (error.message.includes('not found') || error.message.includes('Not Found')) {
      return createSafeError(errorMessages.notFound, 404, 'NOT_FOUND');
    }
  }

  // Default to generic server error
  return createSafeError(errorMessages.serverError, 500, 'INTERNAL_ERROR');
}

/**
 * Create error response
 */
export function createErrorResponse(error: SafeError): Response {
  return new Response(
    JSON.stringify({
      message: error.message,
      code: error.code,
    }),
    {
      status: error.statusCode,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

