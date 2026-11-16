import { applyDecorators } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';

// Documentation metadata only. The handlers keep reading the raw query, so
// `limit` and `cursor` stay validated by the Chat Application layer and never
// pass through a bound query DTO.
export function ApiContactListQuery() {
  return applyDecorators(
    ApiQuery({
      name: 'limit',
      required: false,
      description:
        'A single value made only of ASCII digits, from 1 to 50. Defaults to 20 when absent. A larger value is rejected, not clamped.',
      schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
    }),
    ApiQuery({
      name: 'cursor',
      required: false,
      description:
        'A single opaque value previously returned as nextCursor. Clients must not construct, parse, or modify it.',
      schema: { type: 'string' },
    }),
  );
}
