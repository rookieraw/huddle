import {
  ContactRequestUnavailableError,
  ContactTargetLookupUnavailableError,
  ContactTargetNotFoundError,
  SelfContactRequestError,
} from '@huddle/chat';
import {
  BadRequestException,
  HttpStatus,
  type ArgumentsHost,
} from '@nestjs/common';
import { ContactRequestAuthenticationRequiredError } from './contact-request-authentication.guard';
import { ContactRequestExceptionFilter } from './contact-request-exception.filter';

function createArgumentsHost() {
  const response = {
    status: jest.fn(),
    json: jest.fn(),
  };
  response.status.mockReturnValue(response);

  return {
    host: {
      switchToHttp: () => ({
        getResponse: () => response,
      }),
    } as unknown as ArgumentsHost,
    response,
  };
}

describe('ContactRequestExceptionFilter', () => {
  it('returns only the fixed safe validation envelope', () => {
    const filter = new ContactRequestExceptionFilter();
    const { host, response } = createArgumentsHost();
    const rejectedValue = 'private-target-value';
    const validationFailure = new BadRequestException({
      statusCode: HttpStatus.BAD_REQUEST,
      message: [
        `targetUserId rejected ${rejectedValue}`,
        'requesterId should not exist',
      ],
      error: 'Bad Request',
      target: {
        targetUserId: rejectedValue,
      },
    });

    filter.catch(validationFailure, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith({
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
    expect(JSON.stringify(response.json.mock.calls)).not.toContain(
      rejectedValue,
    );
  });

  it('returns the fixed authentication-required envelope', () => {
    const filter = new ContactRequestExceptionFilter();
    const { host, response } = createArgumentsHost();

    filter.catch(new ContactRequestAuthenticationRequiredError(), host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication is required.',
      },
    });
  });

  it.each([
    {
      exception: new SelfContactRequestError(),
      status: HttpStatus.BAD_REQUEST,
      code: 'SELF_CONTACT_REQUEST',
      message: 'A Contact request cannot target the requester.',
    },
    {
      exception: new ContactTargetNotFoundError(),
      status: HttpStatus.NOT_FOUND,
      code: 'CONTACT_TARGET_NOT_FOUND',
      message: 'Contact target was not found.',
    },
    {
      exception: new ContactTargetLookupUnavailableError(),
      status: HttpStatus.SERVICE_UNAVAILABLE,
      code: 'CONTACT_TARGET_LOOKUP_UNAVAILABLE',
      message: 'Contact target validation is temporarily unavailable.',
    },
    {
      exception: new ContactRequestUnavailableError(),
      status: HttpStatus.SERVICE_UNAVAILABLE,
      code: 'CONTACT_REQUEST_UNAVAILABLE',
      message: 'Contact request service is temporarily unavailable.',
    },
  ])(
    'returns the fixed $code envelope',
    ({ exception, status, code, message }) => {
      const filter = new ContactRequestExceptionFilter();
      const { host, response } = createArgumentsHost();

      filter.catch(exception, host);

      expect(response.status).toHaveBeenCalledWith(status);
      expect(response.json).toHaveBeenCalledWith({
        error: {
          code,
          message,
        },
      });
    },
  );

  it('returns only the fixed internal-error envelope for an unexpected failure', () => {
    const filter = new ContactRequestExceptionFilter();
    const { host, response } = createArgumentsHost();
    const internalValues = [
      'Prisma request failed',
      'P2002',
      'chat_contact_relationship_current_pair_key',
      'private@example.com',
      'secret-access-token',
      'D:\\internal\\contact-request.ts',
    ];
    const unexpectedFailure = Object.assign(new Error(internalValues[0]), {
      code: internalValues[1],
      constraint: internalValues[2],
      principalEmail: internalValues[3],
      token: internalValues[4],
      stack: internalValues[5],
    });

    filter.catch(unexpectedFailure, host);

    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
      },
    });

    const serializedResponse = JSON.stringify(response.json.mock.calls);
    for (const internalValue of internalValues) {
      expect(serializedResponse).not.toContain(internalValue);
    }
  });
});
