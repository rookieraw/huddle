import { ApiProperty } from '@nestjs/swagger';

export class CurrentUserDto {
  @ApiProperty({
    description: 'Stable identifier of the authenticated user.',
    example: 'user-id',
  })
  id!: string;

  @ApiProperty({ description: 'The email address of the authenticated user.' })
  email!: string;

  @ApiProperty({
    description:
      'Transitional: a hardcoded Free tier. Billing will own the tier once it exists, and a composed current-user endpoint will replace this one.',
    enum: ['free'],
  })
  tier!: 'free';
}
