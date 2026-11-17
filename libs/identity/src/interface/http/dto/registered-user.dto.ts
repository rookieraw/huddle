import { ApiProperty } from '@nestjs/swagger';

export class RegisteredUserDto {
  @ApiProperty({
    description: 'Stable identifier of the new user.',
    example: 'user-id',
  })
  id!: string;

  @ApiProperty({ description: 'The registered email address.' })
  email!: string;

  @ApiProperty({
    description: 'The display name, after trimming.',
    example: 'User Name',
  })
  displayName!: string;

  @ApiProperty({
    description:
      'Transitional: returned only because verification email delivery does not exist yet. It will be removed from the response once real email delivery exists.',
  })
  verificationToken!: string;
}
