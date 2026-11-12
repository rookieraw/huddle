import { Module } from '@nestjs/common';
import {
  AcceptContactRequestUseCase,
  CHAT_CLOCK,
  CONTACT_RELATIONSHIP_REPOSITORY,
  CONTACT_TARGET_DIRECTORY,
  ChatPersistenceModule,
  ListAcceptedContactsUseCase,
  ListIncomingContactRequestsUseCase,
  ListOutgoingContactRequestsUseCase,
  USER_PROFILE_DIRECTORY,
  RejectContactRequestUseCase,
  RemoveContactUseCase,
  SendContactRequestUseCase,
} from '@huddle/chat';
import type {
  ChatClock,
  ContactRelationshipRepository,
  ContactTargetDirectory,
  UserProfileDirectory,
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
import { ContactsController } from '../../interface/http/chat/contacts.controller';
import { IdentityContactTargetDirectoryAdapter } from './identity-contact-target-directory.adapter';
import { IdentityUserProfileDirectoryAdapter } from './identity-user-profile-directory.adapter';

@Module({
  imports: [IdentityModule, ChatPersistenceModule],
  controllers: [ContactRequestsController, ContactsController],
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
      provide: IdentityUserProfileDirectoryAdapter,
      useFactory: (profileQueryApi: ProfileQueryApi) =>
        new IdentityUserProfileDirectoryAdapter(profileQueryApi),
      inject: [PROFILE_QUERY_API],
    },
    {
      provide: USER_PROFILE_DIRECTORY,
      useExisting: IdentityUserProfileDirectoryAdapter,
    },
    {
      provide: AcceptContactRequestUseCase,
      useFactory: (
        contactRelationshipRepository: ContactRelationshipRepository,
      ) => new AcceptContactRequestUseCase(contactRelationshipRepository),
      inject: [CONTACT_RELATIONSHIP_REPOSITORY],
    },
    {
      provide: ListAcceptedContactsUseCase,
      useFactory: (
        contactRelationshipRepository: ContactRelationshipRepository,
        profileDirectory: UserProfileDirectory,
      ) =>
        new ListAcceptedContactsUseCase(
          contactRelationshipRepository,
          profileDirectory,
        ),
      inject: [CONTACT_RELATIONSHIP_REPOSITORY, USER_PROFILE_DIRECTORY],
    },
    {
      provide: ListIncomingContactRequestsUseCase,
      useFactory: (
        contactRelationshipRepository: ContactRelationshipRepository,
        profileDirectory: UserProfileDirectory,
      ) =>
        new ListIncomingContactRequestsUseCase(
          contactRelationshipRepository,
          profileDirectory,
        ),
      inject: [CONTACT_RELATIONSHIP_REPOSITORY, USER_PROFILE_DIRECTORY],
    },
    {
      provide: ListOutgoingContactRequestsUseCase,
      useFactory: (
        contactRelationshipRepository: ContactRelationshipRepository,
        profileDirectory: UserProfileDirectory,
      ) =>
        new ListOutgoingContactRequestsUseCase(
          contactRelationshipRepository,
          profileDirectory,
        ),
      inject: [CONTACT_RELATIONSHIP_REPOSITORY, USER_PROFILE_DIRECTORY],
    },
    {
      provide: RejectContactRequestUseCase,
      useFactory: (
        contactRelationshipRepository: ContactRelationshipRepository,
      ) => new RejectContactRequestUseCase(contactRelationshipRepository),
      inject: [CONTACT_RELATIONSHIP_REPOSITORY],
    },
    {
      provide: CHAT_CLOCK,
      useValue: { now: () => new Date() } satisfies ChatClock,
    },
    {
      provide: RemoveContactUseCase,
      useFactory: (
        contactRelationshipRepository: ContactRelationshipRepository,
        clock: ChatClock,
      ) => new RemoveContactUseCase(contactRelationshipRepository, clock),
      inject: [CONTACT_RELATIONSHIP_REPOSITORY, CHAT_CLOCK],
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
