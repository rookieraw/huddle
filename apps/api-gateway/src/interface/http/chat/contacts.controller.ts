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
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ApiContactErrorResponses } from './contact-error-responses.decorator';
import { ApiContactListQuery } from './contact-list-query.decorator';
import { AcceptedContactPageDto } from './dto/contact-listing-response.dto';

type VerifiedContactRequest = ContactRequestAuthenticatedRequest & {
  user: {
    userId: string;
  };
};

@Controller('contacts')
@ApiTags('Contacts')
@ApiBearerAuth()
@UseGuards(ContactRequestAuthenticationGuard)
@UseFilters(ContactRequestExceptionFilter)
export class ContactsController {
  constructor(
    private readonly listAcceptedContactsUseCase: ListAcceptedContactsUseCase,
    private readonly removeContactUseCase: RemoveContactUseCase,
  ) {}

  @Get()
  @ApiContactListQuery()
  @ApiOkResponse({
    type: AcceptedContactPageDto,
    description: 'A page of accepted Contacts of the verified actor.',
  })
  @ApiContactErrorResponses(
    {
      400: ['VALIDATION_FAILED'],
      401: ['AUTHENTICATION_REQUIRED'],
      500: ['INTERNAL_ERROR'],
      503: ['ACCEPTED_CONTACT_LISTING_UNAVAILABLE'],
    },
    ['limit', 'cursor'],
  )
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
  @ApiParam({
    name: 'contactUserId',
    description: 'The user id of the accepted Contact to remove.',
  })
  @ApiNoContentResponse({
    description:
      'The accepted Contact is removed. The response has no content.',
  })
  @ApiContactErrorResponses({
    401: ['AUTHENTICATION_REQUIRED'],
    404: ['CONTACT_NOT_FOUND'],
    500: ['INTERNAL_ERROR'],
    503: ['CONTACT_REMOVAL_UNAVAILABLE'],
  })
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
