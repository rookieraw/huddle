import { applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { contactErrorMessages } from './contact-error-messages';
import { ApplicationErrorEnvelopeDto } from './dto/application-error-response.dto';

const errorStatusDescriptions: Record<number, string> = {
  400: 'The request failed validation or is not allowed.',
  401: 'Authentication is missing or unusable.',
  404: 'The target resource was not found.',
  409: 'The relationship is in a conflicting state.',
  500: 'An unclassified unexpected failure.',
  503: 'A required dependency is temporarily unavailable.',
};

function messageOf(code: string): string {
  const message = contactErrorMessages[code];

  if (message === undefined) {
    throw new Error(`No documented message for error code ${code}.`);
  }

  return message;
}

/**
 * Documents the error responses of a Contacts operation. It is documentation
 * only: the exception filter produces the actual responses.
 */
export function ApiContactErrorResponses(
  errors: Record<number, readonly string[]>,
) {
  return applyDecorators(
    ApiExtraModels(ApplicationErrorEnvelopeDto),
    ...Object.entries(errors).map(([status, codes]) =>
      ApiResponse({
        status: Number(status),
        description: errorStatusDescriptions[Number(status)],
        examples: Object.fromEntries(
          codes.map((code) => [
            code,
            {
              summary: code,
              value: { error: { code, message: messageOf(code) } },
            },
          ]),
        ),
        schema: {
          allOf: [
            { $ref: getSchemaPath(ApplicationErrorEnvelopeDto) },
            {
              type: 'object',
              properties: {
                error: {
                  type: 'object',
                  properties: {
                    code: { type: 'string', enum: [...codes] },
                  },
                },
              },
            },
          ],
        },
      }),
    ),
  );
}
