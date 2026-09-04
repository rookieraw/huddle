import {
  ContactRelationshipNotFoundError,
  ContactRequestAcceptanceNotAuthorizedError,
  ContactRequestAcceptanceUnavailableError,
  ContactRequestAlreadyAcceptedError,
  ContactRequestUnavailableError,
  ContactTargetLookupUnavailableError,
  ContactTargetNotFoundError,
  SelfContactRequestError,
} from '@huddle/chat';
import {
  Catch,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { ApiValidationException } from '../api-validation.pipe';
import { ContactRequestAuthenticationRequiredError } from './contact-request-authentication.guard';

type ContactRequestHttpResponse = {
  status(statusCode: number): ContactRequestHttpResponse;
  json(body: unknown): void;
};

type ContactRequestPublicError = {
  code: string;
  message: string;
  details?: Array<{
    field: string;
    message: string;
  }>;
};

function writeErrorResponse(
  response: ContactRequestHttpResponse,
  statusCode: HttpStatus,
  error: ContactRequestPublicError,
): void {
  response.status(statusCode).json({ error });
}

@Catch()
export class ContactRequestExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host
      .switchToHttp()
      .getResponse<ContactRequestHttpResponse>();

    if (exception instanceof ContactRequestAuthenticationRequiredError) {
      writeErrorResponse(response, HttpStatus.UNAUTHORIZED, {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication is required.',
      });

      return;
    }

    if (exception instanceof SelfContactRequestError) {
      writeErrorResponse(response, HttpStatus.BAD_REQUEST, {
        code: 'SELF_CONTACT_REQUEST',
        message: 'A Contact request cannot target the requester.',
      });

      return;
    }

    if (exception instanceof ContactTargetNotFoundError) {
      writeErrorResponse(response, HttpStatus.NOT_FOUND, {
        code: 'CONTACT_TARGET_NOT_FOUND',
        message: 'Contact target was not found.',
      });

      return;
    }

    if (exception instanceof ContactTargetLookupUnavailableError) {
      writeErrorResponse(response, HttpStatus.SERVICE_UNAVAILABLE, {
        code: 'CONTACT_TARGET_LOOKUP_UNAVAILABLE',
        message: 'Contact target validation is temporarily unavailable.',
      });

      return;
    }

    if (
      exception instanceof ContactRelationshipNotFoundError ||
      exception instanceof ContactRequestAcceptanceNotAuthorizedError
    ) {
      writeErrorResponse(response, HttpStatus.NOT_FOUND, {
        code: 'CONTACT_REQUEST_NOT_FOUND',
        message: 'Contact request was not found.',
      });

      return;
    }

    if (exception instanceof ContactRequestAlreadyAcceptedError) {
      writeErrorResponse(response, HttpStatus.CONFLICT, {
        code: 'CONTACT_REQUEST_ALREADY_ACCEPTED',
        message: 'Contact request has already been accepted.',
      });

      return;
    }

    if (exception instanceof ContactRequestAcceptanceUnavailableError) {
      writeErrorResponse(response, HttpStatus.SERVICE_UNAVAILABLE, {
        code: 'CONTACT_REQUEST_ACCEPTANCE_UNAVAILABLE',
        message: 'Contact request acceptance is temporarily unavailable.',
      });

      return;
    }

    if (exception instanceof ContactRequestUnavailableError) {
      writeErrorResponse(response, HttpStatus.SERVICE_UNAVAILABLE, {
        code: 'CONTACT_REQUEST_UNAVAILABLE',
        message: 'Contact request service is temporarily unavailable.',
      });

      return;
    }

    if (exception instanceof ApiValidationException) {
      writeErrorResponse(response, HttpStatus.BAD_REQUEST, {
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed.',
        details: [
          {
            field: 'targetUserId',
            message: 'targetUserId must be a non-empty string.',
          },
        ],
      });

      return;
    }

    writeErrorResponse(response, HttpStatus.INTERNAL_SERVER_ERROR, {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
    });
  }
}
