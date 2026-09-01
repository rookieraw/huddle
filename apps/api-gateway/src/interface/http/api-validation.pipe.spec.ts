import {
  BadRequestException,
  type ArgumentMetadata,
  ValidationPipe,
} from '@nestjs/common';
import { IsString } from 'class-validator';
import {
  ApiValidationException,
  ApiValidationPipe,
} from './api-validation.pipe';

class ValidationFixtureDto {
  @IsString()
  value!: string;
}

const bodyMetadata: ArgumentMetadata = {
  type: 'body',
  metatype: ValidationFixtureDto,
};

async function captureFailure(pipe: ValidationPipe): Promise<unknown> {
  return pipe.transform({ value: 42 }, bodyMetadata).then(
    () => undefined,
    (error: unknown) => error,
  );
}

describe('ApiValidationPipe', () => {
  it('preserves the default validation status and response under a stable type', async () => {
    const defaultFailure = await captureFailure(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    const apiFailure = await captureFailure(new ApiValidationPipe());

    expect(defaultFailure).toBeInstanceOf(BadRequestException);
    expect(apiFailure).toBeInstanceOf(ApiValidationException);

    if (
      !(defaultFailure instanceof BadRequestException) ||
      !(apiFailure instanceof ApiValidationException)
    ) {
      throw new Error('Expected both validation pipes to reject the input.');
    }

    expect(apiFailure.getStatus()).toBe(defaultFailure.getStatus());
    expect(apiFailure.getResponse()).toEqual(defaultFailure.getResponse());
  });

  it('preserves whitelist and transform behavior', async () => {
    const result: unknown = await new ApiValidationPipe().transform(
      { value: 'accepted', unsupported: 'removed' },
      bodyMetadata,
    );

    expect(result).toBeInstanceOf(ValidationFixtureDto);
    expect(result).toEqual({ value: 'accepted' });
  });
});
