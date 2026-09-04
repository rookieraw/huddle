import {
  AcceptContactRequestUseCase,
  SendContactRequestUseCase,
} from '@huddle/chat';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ContactRequestAuthenticationGuard,
  type ContactRequestAuthenticatedRequest,
} from './contact-request-authentication.guard';
import { ContactRequestExceptionFilter } from './contact-request-exception.filter';
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
  ) {}

  @Post(':contactRequestId/accept')
  @HttpCode(HttpStatus.OK)
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
