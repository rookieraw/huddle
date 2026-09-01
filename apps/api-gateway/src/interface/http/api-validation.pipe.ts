import {
  BadRequestException,
  type ValidationError,
  ValidationPipe,
} from '@nestjs/common';

export class ApiValidationException extends BadRequestException {
  constructor(response: string | object) {
    super(response);
    this.name = 'ApiValidationException';
  }
}

export class ApiValidationPipe extends ValidationPipe {
  constructor() {
    super({ whitelist: true, transform: true });
  }

  override createExceptionFactory(): (
    validationErrors?: ValidationError[],
  ) => unknown {
    const createDefaultException = super.createExceptionFactory();

    return (validationErrors = []) => {
      const exception = createDefaultException(validationErrors);

      if (!(exception instanceof BadRequestException)) {
        return exception;
      }

      return new ApiValidationException(exception.getResponse());
    };
  }
}
