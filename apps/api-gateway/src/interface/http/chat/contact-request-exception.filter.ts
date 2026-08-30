import {
  BadRequestException,
  Catch,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { ContactRequestAuthenticationRequiredError } from './contact-request-authentication.guard';

type ContactRequestHttpResponse = {
  status(statusCode: number): ContactRequestHttpResponse;
  json(body: unknown): void;
};

@Catch()
export class ContactRequestExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    if (exception instanceof ContactRequestAuthenticationRequiredError) {
      const response = host
        .switchToHttp()
        .getResponse<ContactRequestHttpResponse>();

      response.status(HttpStatus.UNAUTHORIZED).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required.',
        },
      });

      return;
    }

    if (exception instanceof BadRequestException) {
      const response = host
        .switchToHttp()
        .getResponse<ContactRequestHttpResponse>();

      response.status(HttpStatus.BAD_REQUEST).json({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Request validation failed.',
          details: [
            {
              field: 'targetUserId',
              message: 'targetUserId must be a non-empty string.',
            },
          ],
        },
      });

      return;
    }

    throw exception;
  }
}
