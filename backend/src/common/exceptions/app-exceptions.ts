import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Exceptions that carry a stable machine code alongside the message.
 *
 * Nest's built-ins only carry prose, and the app and admin dashboard need to
 * branch on specific failures — "you are outside the geofence" has to render
 * differently from "your photo was a duplicate". AllExceptionsFilter reads the
 * `code` field off the response body these produce.
 */
export class CodedException extends HttpException {
  constructor(status: HttpStatus, message: string, code: string, details?: unknown) {
    super({ statusCode: status, message, code, details }, status);
  }
}

export class BadRequestException extends CodedException {
  constructor(message: string, code = 'bad_request', details?: unknown) {
    super(HttpStatus.BAD_REQUEST, message, code, details);
  }
}

export class UnauthorizedException extends CodedException {
  constructor(message: string, code = 'unauthorized', details?: unknown) {
    super(HttpStatus.UNAUTHORIZED, message, code, details);
  }
}

export class ForbiddenException extends CodedException {
  constructor(message: string, code = 'forbidden', details?: unknown) {
    super(HttpStatus.FORBIDDEN, message, code, details);
  }
}

export class NotFoundException extends CodedException {
  constructor(message: string, code = 'not_found', details?: unknown) {
    super(HttpStatus.NOT_FOUND, message, code, details);
  }
}

export class ConflictException extends CodedException {
  constructor(message: string, code = 'conflict', details?: unknown) {
    super(HttpStatus.CONFLICT, message, code, details);
  }
}

export class UnprocessableException extends CodedException {
  constructor(message: string, code = 'invalid_payload', details?: unknown) {
    super(HttpStatus.UNPROCESSABLE_ENTITY, message, code, details);
  }
}

export class TooManyRequestsException extends CodedException {
  constructor(message: string, code = 'rate_limited', details?: unknown) {
    super(HttpStatus.TOO_MANY_REQUESTS, message, code, details);
  }
}
