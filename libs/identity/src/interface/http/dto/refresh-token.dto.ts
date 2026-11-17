import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({
    description:
      'The current refresh token. A successful refresh rotates it, so the previous value must be replaced.',
  })
  @IsString()
  refreshToken!: string;
}
