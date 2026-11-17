import { ApiProperty } from '@nestjs/swagger';

export class AuthTokensDto {
  @ApiProperty({
    description:
      'A short-lived JWT access token, sent as a bearer token on protected operations.',
  })
  accessToken!: string;

  @ApiProperty({
    description:
      'An opaque refresh token. The refresh operation rotates it, so clients must replace the previous value.',
  })
  refreshToken!: string;
}
