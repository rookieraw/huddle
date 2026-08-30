import {
  BadRequestException,
  HttpStatus,
  type ArgumentsHost,
} from '@nestjs/common';
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
});
