import {
  ListAcceptedContactsUseCase,
  RemoveContactUseCase,
} from '@huddle/chat';
import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
    private readonly removeContactUseCase: RemoveContactUseCase,
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

  @Delete(':contactUserId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeContact(
    @Req() request: VerifiedContactRequest,
    @Param('contactUserId') contactUserId: string,
  ): Promise<void> {
    await this.removeContactUseCase.execute({
      removingUserId: request.user.userId,
      contactUserId,
    });
  }
}
