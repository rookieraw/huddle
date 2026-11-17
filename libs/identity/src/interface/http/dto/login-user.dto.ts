import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginUserDto {
  @ApiProperty({
    description: 'The email address of the account. It must be a valid email.',
    format: 'email',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'The account password.' })
  @IsString()
  password!: string;
}
