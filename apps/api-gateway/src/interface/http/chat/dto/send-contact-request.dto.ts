import { IsNotEmpty, IsString } from 'class-validator';

export class SendContactRequestDto {
  @IsString()
  @IsNotEmpty()
  targetUserId!: string;
}
