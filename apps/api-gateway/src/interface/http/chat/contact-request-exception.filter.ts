import {
  ContactRequestUnavailableError,
  ContactTargetLookupUnavailableError,
  ContactTargetNotFoundError,
  SelfContactRequestError,
} from '@huddle/chat';
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

    if (exception instanceof SelfContactRequestError) {
      const response = host
        .switchToHttp()
        .getResponse<ContactRequestHttpResponse>();

      response.status(HttpStatus.BAD_REQUEST).json({
        error: {
          code: 'SELF_CONTACT_REQUEST',
          message: 'A Contact request cannot target the requester.',
        },
      });

      return;
    }

    if (exception instanceof ContactTargetNotFoundError) {
      const response = host
        .switchToHttp()
        .getResponse<ContactRequestHttpResponse>();

      response.status(HttpStatus.NOT_FOUND).json({
        error: {
          code: 'CONTACT_TARGET_NOT_FOUND',
          message: 'Contact target was not found.',
        },
      });

      return;
    }

    if (exception instanceof ContactTargetLookupUnavailableError) {
      const response = host
        .switchToHttp()
        .getResponse<ContactRequestHttpResponse>();

      response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        error: {
          code: 'CONTACT_TARGET_LOOKUP_UNAVAILABLE',
          message: 'Contact target validation is temporarily unavailable.',
        },
      });

      return;
    }

    if (exception instanceof ContactRequestUnavailableError) {
      const response = host
        .switchToHttp()
        .getResponse<ContactRequestHttpResponse>();

      response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        error: {
          code: 'CONTACT_REQUEST_UNAVAILABLE',
          message: 'Contact request service is temporarily unavailable.',
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
