import { applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { TransitionalIdentityErrorDto } from './dto/transitional-identity-error.dto';

export const VALIDATION_FAILURE = 'The request body failed validation.';
export const UNEXPECTED_FAILURE = 'An unexpected infrastructure failure.';

/**
 * Documents the error responses of an Identity operation, keyed by status.
 * It is documentation only: the framework produces the actual bodies, and each
 * response is narrowed to its own status.
 */
export function ApiIdentityErrorResponses(errors: Record<number, string>) {
  return applyDecorators(
    ApiExtraModels(TransitionalIdentityErrorDto),
    ...Object.entries(errors).map(([status, description]) =>
      ApiResponse({
        status: Number(status),
        description,
        schema: {
          allOf: [
            { $ref: getSchemaPath(TransitionalIdentityErrorDto) },
            {
              type: 'object',
              properties: {
                statusCode: { type: 'integer', enum: [Number(status)] },
              },
            },
          ],
        },
      }),
    ),
  );
}
