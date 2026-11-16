import type {
  AcceptedContactItem,
  AcceptedContactPage,
  IncomingContactRequestItem,
  IncomingContactRequestPage,
  OutgoingContactRequestItem,
  OutgoingContactRequestPage,
} from '@huddle/chat';
import { ApiProperty } from '@nestjs/swagger';

const displayNameDescription =
  'Current presentation text from Identity. It is non-unique, user-controlled, and untrusted, and it is null when Identity has no profile.';
const nextCursorDescription =
  'Pass it as the cursor query parameter to read the next page. It is null on the last page.';

export class IncomingContactRequestDto implements IncomingContactRequestItem {
  @ApiProperty({
    description: 'The contactRequestId to use with acceptance and rejection.',
    example: 'relationship-id',
  })
  id!: string;

  @ApiProperty({
    description: 'The authoritative user who created the request.',
    example: 'user-requester',
  })
  requesterId!: string;

  @ApiProperty({
    description: displayNameDescription,
    example: 'Requester Name',
    nullable: true,
    type: String,
  })
  displayName!: string | null;

  @ApiProperty({
    description: 'Always pending; no other state is listed.',
    enum: ['pending'],
    example: 'pending',
  })
  status!: 'pending';
}

export class IncomingContactRequestPageDto implements IncomingContactRequestPage {
  @ApiProperty({
    description:
      'At most the requested limit of pending requests addressed to the verified actor. Empty when there are none.',
    isArray: true,
    type: IncomingContactRequestDto,
  })
  items!: IncomingContactRequestDto[];

  @ApiProperty({
    description: nextCursorDescription,
    example: 'opaque-cursor',
    nullable: true,
    type: String,
  })
  nextCursor!: string | null;
}

export class OutgoingContactRequestDto implements OutgoingContactRequestItem {
  @ApiProperty({
    description: 'The opaque identifier of the Contact request.',
    example: 'relationship-id',
  })
  id!: string;

  @ApiProperty({
    description: 'The authoritative user the request was sent to.',
    example: 'user-recipient',
  })
  recipientId!: string;

  @ApiProperty({
    description: displayNameDescription,
    example: 'Recipient Name',
    nullable: true,
    type: String,
  })
  displayName!: string | null;

  @ApiProperty({
    description: 'Always pending; no other state is listed.',
    enum: ['pending'],
    example: 'pending',
  })
  status!: 'pending';
}

export class OutgoingContactRequestPageDto implements OutgoingContactRequestPage {
  @ApiProperty({
    description:
      'At most the requested limit of pending requests created by the verified actor. Empty when there are none.',
    isArray: true,
    type: OutgoingContactRequestDto,
  })
  items!: OutgoingContactRequestDto[];

  @ApiProperty({
    description: nextCursorDescription,
    example: 'opaque-cursor',
    nullable: true,
    type: String,
  })
  nextCursor!: string | null;
}

export class AcceptedContactDto implements AcceptedContactItem {
  @ApiProperty({
    description: 'The authoritative user who is the Contact.',
    example: 'user-contact',
  })
  userId!: string;

  @ApiProperty({
    description: displayNameDescription,
    example: 'Contact Name',
    nullable: true,
    type: String,
  })
  displayName!: string | null;
}

export class AcceptedContactPageDto implements AcceptedContactPage {
  @ApiProperty({
    description:
      'At most the requested limit of accepted Contacts of the verified actor. Empty when there are none.',
    isArray: true,
    type: AcceptedContactDto,
  })
  items!: AcceptedContactDto[];

  @ApiProperty({
    description: nextCursorDescription,
    example: 'opaque-cursor',
    nullable: true,
    type: String,
  })
  nextCursor!: string | null;
}
