import {
  AcceptContactRequestUseCase,
  ListIncomingContactRequestsUseCase,
  ListOutgoingContactRequestsUseCase,
  RejectContactRequestUseCase,
  SendContactRequestUseCase,
} from '@huddle/chat';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import {
  ContactRequestAuthenticationGuard,
  type ContactRequestAuthenticatedRequest,
} from './contact-request-authentication.guard';
import { ContactRequestExceptionFilter } from './contact-request-exception.filter';
import { ApiContactListQuery } from './contact-list-query.decorator';
import {
  AcceptedContactRequestDto,
  ContactRequestDto,
  RejectedContactRequestDto,
} from './dto/contact-request-response.dto';
import {
  IncomingContactRequestPageDto,
  OutgoingContactRequestPageDto,
} from './dto/contact-listing-response.dto';
import { SendContactRequestDto } from './dto/send-contact-request.dto';

type VerifiedContactRequest = ContactRequestAuthenticatedRequest & {
  user: {
    userId: string;
  };
};

@Controller('contact-requests')
@UseGuards(ContactRequestAuthenticationGuard)
@UseFilters(ContactRequestExceptionFilter)
export class ContactRequestsController {
  constructor(
    private readonly sendContactRequestUseCase: SendContactRequestUseCase,
    private readonly acceptContactRequestUseCase: AcceptContactRequestUseCase,
    private readonly rejectContactRequestUseCase: RejectContactRequestUseCase,
    private readonly listIncomingContactRequestsUseCase: ListIncomingContactRequestsUseCase,
    private readonly listOutgoingContactRequestsUseCase: ListOutgoingContactRequestsUseCase,
  ) {}

  @Get('incoming')
  @ApiContactListQuery()
  @ApiOkResponse({
    type: IncomingContactRequestPageDto,
    description:
      'A page of pending Contact requests addressed to the verified actor.',
  })
  listIncomingContactRequests(
    @Req() request: VerifiedContactRequest,
    @Query() query: Record<string, unknown>,
  ) {
    return this.listIncomingContactRequestsUseCase.execute({
      recipientId: request.user.userId,
      limit: query.limit,
      cursor: query.cursor,
    });
  }

  @Get('outgoing')
  @ApiContactListQuery()
  @ApiOkResponse({
    type: OutgoingContactRequestPageDto,
    description:
      'A page of pending Contact requests created by the verified actor.',
  })
  listOutgoingContactRequests(
    @Req() request: VerifiedContactRequest,
    @Query() query: Record<string, unknown>,
  ) {
    return this.listOutgoingContactRequestsUseCase.execute({
      requesterId: request.user.userId,
      limit: query.limit,
      cursor: query.cursor,
    });
  }

  @Post(':contactRequestId/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    type: RejectedContactRequestDto,
    description: 'The Contact request is persisted as rejected.',
  })
  async rejectContactRequest(
    @Req() request: VerifiedContactRequest,
    @Param('contactRequestId') contactRequestId: string,
  ) {
    const relationship = await this.rejectContactRequestUseCase.execute({
      rejectingUserId: request.user.userId,
      relationshipId: contactRequestId,
    });

    return {
      id: relationship.id,
      requesterId: relationship.requesterId,
      recipientId: relationship.recipientId,
      status: 'rejected' as const,
    };
  }

  @Post(':contactRequestId/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    type: AcceptedContactRequestDto,
    description: 'The Contact request is persisted as accepted.',
  })
  async acceptContactRequest(
    @Req() request: VerifiedContactRequest,
    @Param('contactRequestId') contactRequestId: string,
  ) {
    const relationship = await this.acceptContactRequestUseCase.execute({
      acceptingUserId: request.user.userId,
      relationshipId: contactRequestId,
    });

    if (!relationship.isAccepted()) {
      throw new Error('Unsupported ContactRelationship status.');
    }

    return {
      id: relationship.id,
      requesterId: relationship.requesterId,
      recipientId: relationship.recipientId,
      status: 'accepted' as const,
    };
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    type: ContactRequestDto,
    description:
      'The persisted relationship, whether newly created or reused. Its status is returned as persisted.',
  })
  async createContactRequest(
    @Req() request: VerifiedContactRequest,
    @Body() dto: SendContactRequestDto,
  ) {
    const relationship = await this.sendContactRequestUseCase.execute({
      requesterId: request.user.userId,
      targetUserId: dto.targetUserId,
    });
    let status: 'pending' | 'accepted';

    if (relationship.isPending()) {
      status = 'pending';
    } else if (relationship.isAccepted()) {
      status = 'accepted';
    } else {
      throw new Error('Unsupported ContactRelationship status.');
    }

    return {
      id: relationship.id,
      requesterId: relationship.requesterId,
      recipientId: relationship.recipientId,
      status,
    };
  }
}
