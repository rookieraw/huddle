import { Module } from '@nestjs/common';
import {
  AcceptContactRequestUseCase,
  CONTACT_RELATIONSHIP_REPOSITORY,
  CONTACT_TARGET_DIRECTORY,
  ChatPersistenceModule,
  ListIncomingContactRequestsUseCase,
  REQUESTER_PROFILE_DIRECTORY,
  RejectContactRequestUseCase,
  SendContactRequestUseCase,
} from '@huddle/chat';
import type {
  ContactRelationshipRepository,
  ContactTargetDirectory,
  RequesterProfileDirectory,
} from '@huddle/chat';
import {
  DIRECTORY_API,
  IdentityModule,
  PROFILE_QUERY_API,
} from '@huddle/identity';
import type { DirectoryApi, ProfileQueryApi } from '@huddle/identity';
import { ContactRequestAuthenticationGuard } from '../../interface/http/chat/contact-request-authentication.guard';
import { ContactRequestExceptionFilter } from '../../interface/http/chat/contact-request-exception.filter';
import { ContactRequestsController } from '../../interface/http/chat/contact-requests.controller';
import { IdentityContactTargetDirectoryAdapter } from './identity-contact-target-directory.adapter';
import { IdentityRequesterProfileDirectoryAdapter } from './identity-requester-profile-directory.adapter';

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
      provide: IdentityRequesterProfileDirectoryAdapter,
      useFactory: (profileQueryApi: ProfileQueryApi) =>
        new IdentityRequesterProfileDirectoryAdapter(profileQueryApi),
      inject: [PROFILE_QUERY_API],
    },
    {
      provide: REQUESTER_PROFILE_DIRECTORY,
      useExisting: IdentityRequesterProfileDirectoryAdapter,
    },
    {
      provide: AcceptContactRequestUseCase,
      useFactory: (
        contactRelationshipRepository: ContactRelationshipRepository,
      ) => new AcceptContactRequestUseCase(contactRelationshipRepository),
      inject: [CONTACT_RELATIONSHIP_REPOSITORY],
    },
    {
      provide: ListIncomingContactRequestsUseCase,
      useFactory: (
        contactRelationshipRepository: ContactRelationshipRepository,
        requesterProfileDirectory: RequesterProfileDirectory,
      ) =>
        new ListIncomingContactRequestsUseCase(
          contactRelationshipRepository,
          requesterProfileDirectory,
        ),
      inject: [CONTACT_RELATIONSHIP_REPOSITORY, REQUESTER_PROFILE_DIRECTORY],
    },
    {
      provide: RejectContactRequestUseCase,
      useFactory: (
        contactRelationshipRepository: ContactRelationshipRepository,
      ) => new RejectContactRequestUseCase(contactRelationshipRepository),
      inject: [CONTACT_RELATIONSHIP_REPOSITORY],
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
