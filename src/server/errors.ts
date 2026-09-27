export class AppError extends Error {
  constructor(message: string, readonly code: string, readonly status: number) {
    super(message);
    this.name = new.target.name;
  }
}
export class NotFoundError extends AppError {
  constructor(what = 'Resource') { super(`${what} not found`, 'not_found', 404); }
}
export class ValidationError extends AppError {
  constructor(message: string, readonly issues?: unknown) { super(message, 'validation', 400); }
}
export class ConflictError extends AppError {
  constructor(message: string) { super(message, 'conflict', 409); }
}
export class UnauthorizedError extends AppError {
  constructor(message = 'Not signed in') { super(message, 'unauthorized', 401); }
}
export class RateLimitError extends AppError {
  constructor(readonly retryAfterSec: number) { super(`Too many requests. Try again in ${retryAfterSec}s.`, 'rate_limited', 429); }
}
export class ConfigError extends AppError {
  constructor(message: string) { super(message, 'config', 500); }
}
export class AIError extends AppError {
  constructor(message: string, readonly provider?: string) { super(message, 'ai_error', 502); }
}
export const isAppError = (e: unknown): e is AppError => e instanceof AppError;
