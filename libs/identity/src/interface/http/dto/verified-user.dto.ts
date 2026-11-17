import { ApiProperty } from '@nestjs/swagger';

export class VerifiedUserDto {
  @ApiProperty({
    description: 'Stable identifier of the verified user.',
    example: 'user-id',
  })
  id!: string;

  @ApiProperty({ description: 'The verified email address.' })
  email!: string;

  @ApiProperty({
    description:
      'Always true: a successful response means the email is verified.',
    type: Boolean,
  })
  verified!: boolean;
}
