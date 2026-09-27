export class AppError extends Error {
  constructor(message, { code = 'unknown', status = 0, cause, fields } = {}) {
    super(message, { cause });
    this.name = new.target.name;
    this.code = code;
    this.status = status;
    this.fields = fields ?? {};
  }
}

export class NetworkError extends AppError {
  constructor(message = 'Network request failed', options = {}) { super(message, { code: 'network', ...options }); }
}
export class NotFoundError extends AppError {
  constructor(message = 'Not found', options = {}) { super(message, { code: 'not_found', status: 404, ...options }); }
}
export class RateLimitError extends AppError {
  constructor(message = 'Rate limited', options = {}) { super(message, { code: 'rate_limited', status: 429, ...options }); }
}
export class ValidationError extends AppError {
  constructor(message = 'Validation failed', options = {}) { super(message, { code: 'validation', status: 422, ...options }); }
}
export class AuthError extends AppError {
  constructor(message = 'Not authorized', options = {}) { super(message, { code: 'unauthorized', status: 401, ...options }); }
}

const KNOWN_CODES = new Set([
  'network', 'not_found', 'rate_limited', 'validation', 'unauthorized', 'forbidden',
  'invalid_credentials', 'username_taken', 'email_taken', 'not_enough_tickets', 'match_not_on_sale',
  'card_declined', 'server', 'timeout',
]);

export function errorMessageKey(err) {
  const code = err instanceof AppError ? err.code : 'unknown';
  return KNOWN_CODES.has(code) ? `errors.${code}` : 'errors.unknown';
}
