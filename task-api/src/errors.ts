// Module 5 output: the AppError hierarchy.
// Nothing to run here. Handlers and the service throw these, and middleware/error-handler.ts turns them into the error envelope. It also builds a ValidationError itself from a ZodError (Module 8).

// The AppError hierarchy. Every error the API means to send to a client is an AppError: it
// carries its own HTTP status and a stable, machine-readable code, so the central error handler
// never has to guess. Anything that is not an AppError is a programmer error (a bug), and the
// handler turns it into a generic 500.
//
// Written without parameter properties on purpose: erasableSyntaxOnly (from the M04 tsconfig)
// rejects them, because Node's type stripping cannot erase them.

export type ErrorDetail = { path: string; message: string };

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: ErrorDetail[] | undefined;

  constructor(statusCode: number, code: string, message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request') {
    super(400, 'BAD_REQUEST', message);
  }
}

// The only error that carries `details`: one entry per field that failed.
export class ValidationError extends AppError {
  constructor(details: ErrorDetail[], message = 'Request validation failed') {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(404, 'NOT_FOUND', message);
  }
}

// Defined for the hierarchy. v1 has no rule that conflicts, so no endpoint throws it yet.
export class ConflictError extends AppError {
  constructor(message = 'Request conflicts with the current state') {
    super(409, 'CONFLICT', message);
  }
}
