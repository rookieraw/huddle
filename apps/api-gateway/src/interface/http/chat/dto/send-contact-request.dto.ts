import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SendContactRequestDto {
  @ApiProperty({
    description:
      'Opaque identifier of the user to contact. It is not trimmed or normalized.',
    example: 'user-target',
    minLength: 1,
  })
  @IsString()
  @IsNotEmpty()
  targetUserId!: string;
}
