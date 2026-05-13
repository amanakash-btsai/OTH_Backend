export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly errorCode: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static unauthorized(code = 'UNAUTHORIZED', message = 'Unauthorized'): AppError {
    return new AppError(401, code, message);
  }

  static forbidden(code = 'INSUFFICIENT_PERMISSIONS', message = 'Insufficient permissions'): AppError {
    return new AppError(403, code, message);
  }

  static notFound(code = 'NOT_FOUND', message = 'Resource not found'): AppError {
    return new AppError(404, code, message);
  }

  static conflict(code = 'CONFLICT', message = 'Conflict'): AppError {
    return new AppError(409, code, message);
  }

  static badRequest(
    code = 'BAD_REQUEST',
    message = 'Bad request',
    details?: Record<string, unknown>,
  ): AppError {
    return new AppError(400, code, message, details);
  }

  static internal(code = 'INTERNAL_SERVER_ERROR', message = 'Internal server error'): AppError {
    return new AppError(500, code, message);
  }
}
