import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApplicationErrorDetailDto {
  @ApiProperty({
    description: 'The request field the problem refers to.',
    example: 'targetUserId',
  })
  field!: string;

  @ApiProperty({
    description: 'What is wrong with that field.',
    example: 'targetUserId must be a non-empty string.',
  })
  message!: string;
}

export class ApplicationErrorDto {
  @ApiProperty({
    description:
      'Stable machine-readable error code. The values possible for each response are listed on that response.',
    example: 'VALIDATION_FAILED',
  })
  code!: string;

  @ApiProperty({
    description: 'Fixed human-readable text for the code.',
    example: 'Request validation failed.',
  })
  message!: string;

  @ApiPropertyOptional({
    description: 'Present only for validation failures.',
    isArray: true,
    type: ApplicationErrorDetailDto,
  })
  details?: ApplicationErrorDetailDto[];
}

export class ApplicationErrorEnvelopeDto {
  @ApiProperty({ type: ApplicationErrorDto })
  error!: ApplicationErrorDto;
}
