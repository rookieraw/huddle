import { ApiProperty } from '@nestjs/swagger';

export class ContactRelationshipResponseDto {
  @ApiProperty({
    description: 'Stable identifier of the Contact relationship.',
    example: 'relationship-id',
  })
  id!: string;

  @ApiProperty({
    description:
      'Authoritative user who originally requested the relationship.',
    example: 'user-requester',
  })
  requesterId!: string;

  @ApiProperty({
    description: 'Authoritative user who originally received the request.',
    example: 'user-recipient',
  })
  recipientId!: string;
}

export class ContactRequestDto extends ContactRelationshipResponseDto {
  @ApiProperty({
    description: 'Persisted current status of the relationship.',
    enum: ['pending', 'accepted'],
    example: 'pending',
  })
  status!: 'pending' | 'accepted';
}

export class AcceptedContactRequestDto extends ContactRelationshipResponseDto {
  @ApiProperty({
    description: 'Persisted lifecycle state after successful acceptance.',
    enum: ['accepted'],
    example: 'accepted',
  })
  status!: 'accepted';
}

export class RejectedContactRequestDto extends ContactRelationshipResponseDto {
  @ApiProperty({
    description: 'Persisted lifecycle state after successful rejection.',
    enum: ['rejected'],
    example: 'rejected',
  })
  status!: 'rejected';
}
