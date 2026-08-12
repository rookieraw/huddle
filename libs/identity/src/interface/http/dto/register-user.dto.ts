import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { IsNotBlank } from './is-not-blank.validator';

export class RegisterUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @IsNotBlank()
  @MaxLength(50)
  displayName!: string;
}
