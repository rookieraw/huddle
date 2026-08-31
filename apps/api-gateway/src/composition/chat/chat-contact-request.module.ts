import { Module } from '@nestjs/common';
import {
  CONTACT_RELATIONSHIP_REPOSITORY,
  CONTACT_TARGET_DIRECTORY,
  ChatPersistenceModule,
  SendContactRequestUseCase,
} from '@huddle/chat';
import type {
  ContactRelationshipRepository,
  ContactTargetDirectory,
} from '@huddle/chat';
import { DIRECTORY_API, IdentityModule } from '@huddle/identity';
import type { DirectoryApi } from '@huddle/identity';
import { ContactRequestAuthenticationGuard } from '../../interface/http/chat/contact-request-authentication.guard';
import { ContactRequestExceptionFilter } from '../../interface/http/chat/contact-request-exception.filter';
import { ContactRequestsController } from '../../interface/http/chat/contact-requests.controller';
import { IdentityContactTargetDirectoryAdapter } from './identity-contact-target-directory.adapter';

@Module({
  imports: [IdentityModule, ChatPersistenceModule],
  controllers: [ContactRequestsController],
  providers: [
    ContactRequestAuthenticationGuard,
    ContactRequestExceptionFilter,
    {
      provide: IdentityContactTargetDirectoryAdapter,
      useFactory: (directoryApi: DirectoryApi) =>
        new IdentityContactTargetDirectoryAdapter(directoryApi),
      inject: [DIRECTORY_API],
    },
    {
      provide: CONTACT_TARGET_DIRECTORY,
      useExisting: IdentityContactTargetDirectoryAdapter,
    },
    {
      provide: SendContactRequestUseCase,
      useFactory: (
        contactTargetDirectory: ContactTargetDirectory,
        contactRelationshipRepository: ContactRelationshipRepository,
      ) =>
        new SendContactRequestUseCase(
          contactTargetDirectory,
          contactRelationshipRepository,
        ),
      inject: [CONTACT_TARGET_DIRECTORY, CONTACT_RELATIONSHIP_REPOSITORY],
    },
  ],
})
export class ChatContactRequestModule {}
