import {
  BadRequestException,
  Catch,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';

type ContactRequestHttpResponse = {
  status(statusCode: number): ContactRequestHttpResponse;
  json(body: unknown): void;
};

@Catch()
export class ContactRequestExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    if (!(exception instanceof BadRequestException)) {
      throw exception;
    }

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
  }
}
