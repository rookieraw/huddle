import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({
  description:
    'Transitional, framework-generated error body of the Identity operations. It describes what the framework produces today and is not the stable application error envelope: message may be a string or an array of strings, error may be absent, and statusCode carries the HTTP status. Clients must not branch on message.',
})
export class TransitionalIdentityErrorDto {
  @ApiProperty({
    description: 'The HTTP status of the response.',
    type: 'integer',
  })
  statusCode!: number;

  @ApiProperty({
    description:
      'Human-readable text: one message, or one message per failed validation rule.',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  })
  message!: string | string[];

  @ApiPropertyOptional({
    description: 'The name of the HTTP status. It can be absent.',
    type: String,
  })
  error?: string;
}
