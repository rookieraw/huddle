import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LogoutDto {
  @ApiProperty({
    description:
      'The refresh token to revoke. A token that belongs to another user is rejected.',
  })
  @IsString()
  refreshToken!: string;
}
