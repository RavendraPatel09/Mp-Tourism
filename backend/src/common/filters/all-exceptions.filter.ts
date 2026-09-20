import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { Request, Response } from 'express';

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

/** Postgres error codes we translate rather than leak. */
const PG_UNIQUE_VIOLATION = '23505';
const PG_FOREIGN_KEY_VIOLATION = '23503';
const PG_CHECK_VIOLATION = '23514';

/**
 * One error shape for the whole API, so the app and the admin dashboard can
 * both branch on `code` instead of matching on prose. Database constraint
 * violations are translated here — the constraint name is the contract.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const body = this.toBody(exception);
    body.requestId = (request.headers['x-request-id'] as string) ?? undefined;

    if (body.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} → ${body.statusCode} ${body.code}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ErrorBody {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        return { statusCode: status, code: this.codeFor(status), message: payload };
      }
      const record = payload as Record<string, unknown>;
      return {
        statusCode: status,
        code: (record.code as string) ?? this.codeFor(status),
        message: Array.isArray(record.message)
          ? (record.message as string[]).join('; ')
          : ((record.message as string) ?? exception.message),
        details: record.details ?? (Array.isArray(record.message) ? record.message : undefined),
      };
    }

    if (exception instanceof QueryFailedError) {
      const driverError = exception.driverError as { code?: string; constraint?: string };
      switch (driverError?.code) {
        case PG_UNIQUE_VIOLATION:
          return {
            statusCode: HttpStatus.CONFLICT,
            code: 'conflict',
            message: 'That record already exists.',
            details: { constraint: driverError.constraint },
          };
        case PG_FOREIGN_KEY_VIOLATION:
          return {
            statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
            code: 'invalid_reference',
            message: 'A referenced record does not exist.',
            details: { constraint: driverError.constraint },
          };
        case PG_CHECK_VIOLATION:
          return {
            statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
            code: 'invalid_payload',
            message: 'The request violates a data rule.',
            details: { constraint: driverError.constraint },
          };
        default:
          break;
      }
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'internal_error',
      message: 'Something went wrong on our side.',
    };
  }

  private codeFor(status: number): string {
    return (
      {
        400: 'bad_request',
        401: 'unauthorized',
        403: 'forbidden',
        404: 'not_found',
        409: 'conflict',
        422: 'invalid_payload',
        429: 'rate_limited',
      }[status] ?? 'error'
    );
  }
}
