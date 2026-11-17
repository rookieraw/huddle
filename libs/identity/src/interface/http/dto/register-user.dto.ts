import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotBlank } from './is-not-blank.validator';

export class RegisterUserDto {
  @ApiProperty({
    description: 'The email address to register. It must be a valid email.',
    format: 'email',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'The account password, with a minimum length of 8.',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({
    description:
      'The name shown to other users. Surrounding whitespace is trimmed first; the limits apply after trimming, so the trimmed value must not be blank and has at most 50 Unicode code points.',
    example: 'User Name',
    minLength: 1,
    maxLength: 50,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotBlank()
  @MaxLength(50)
  displayName!: string;
}
