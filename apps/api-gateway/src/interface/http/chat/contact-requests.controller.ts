import { SendContactRequestUseCase } from '@huddle/chat';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
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
  ) {}

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

    return {
      id: relationship.id,
      requesterId: relationship.requesterId,
      recipientId: relationship.recipientId,
      status: 'pending' as const,
    };
  }
}
