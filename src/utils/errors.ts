// ─────────────────────────────────────────────────────────────────────────────
// FILE: utils/errors.ts
// Custom error class used throughout the backend. Instead of throwing raw
// JavaScript Errors, we throw AppErrors that carry an HTTP status code and a
// machine-readable error code (for the frontend to react to programmatically).
//
// Static factory methods provide convenient shortcuts for the most common error
// types so we don't need to remember HTTP status codes in every service file.
// ─────────────────────────────────────────────────────────────────────────────

// AppError extends the built-in Error class so it still has a stack trace,
// but adds statusCode (e.g. 404) and errorCode (e.g. 'NOT_FOUND') for the
// errorHandler middleware to use when building the JSON response.
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly errorCode: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
    // Required when extending built-in classes in TypeScript/ES5 targets
    Object.setPrototypeOf(this, AppError.prototype);
  }

  // 401 — "Who are you?" (not logged in, or token expired)
  static unauthorized(code = 'UNAUTHORIZED', message = 'Unauthorized'): AppError {
    return new AppError(401, code, message);
  }

  // 403 — "I know who you are, but you're not allowed to do this"
  static forbidden(code = 'INSUFFICIENT_PERMISSIONS', message = 'Insufficient permissions'): AppError {
    return new AppError(403, code, message);
  }

  // 404 — "The thing you're looking for doesn't exist"
  static notFound(code = 'NOT_FOUND', message = 'Resource not found'): AppError {
    return new AppError(404, code, message);
  }

  // 409 — "That already exists" (e.g. duplicate email)
  static conflict(code = 'CONFLICT', message = 'Conflict'): AppError {
    return new AppError(409, code, message);
  }

  // 400 — "Your request data is invalid" (missing fields, wrong types, etc.)
  static badRequest(
    code = 'BAD_REQUEST',
    message = 'Bad request',
    details?: Record<string, unknown>,
  ): AppError {
    return new AppError(400, code, message, details);
  }

  // 500 — "Something broke on our end" (unexpected server-side failure)
  static internal(code = 'INTERNAL_SERVER_ERROR', message = 'Internal server error'): AppError {
    return new AppError(500, code, message);
  }
}
