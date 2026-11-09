import { ListAcceptedContactsUseCase } from '@huddle/chat';
import {
  Controller,
  Get,
  Query,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ContactRequestAuthenticationGuard,
  type ContactRequestAuthenticatedRequest,
} from './contact-request-authentication.guard';
import { ContactRequestExceptionFilter } from './contact-request-exception.filter';

type VerifiedContactRequest = ContactRequestAuthenticatedRequest & {
  user: {
    userId: string;
  };
};

@Controller('contacts')
@UseGuards(ContactRequestAuthenticationGuard)
@UseFilters(ContactRequestExceptionFilter)
export class ContactsController {
  constructor(
    private readonly listAcceptedContactsUseCase: ListAcceptedContactsUseCase,
  ) {}

  @Get()
  listAcceptedContacts(
    @Req() request: VerifiedContactRequest,
    @Query() query: Record<string, unknown>,
  ) {
    return this.listAcceptedContactsUseCase.execute({
      userId: request.user.userId,
      limit: query.limit,
      cursor: query.cursor,
    });
  }
}
