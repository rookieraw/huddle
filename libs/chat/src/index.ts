export type { ContactRelationshipRepository } from './application/ports/contact-relationship.repository.port';
export type { ContactTargetDirectory } from './application/ports/contact-target-directory.port';
export { CONTACT_RELATIONSHIP_REPOSITORY } from './application/ports/contact-relationship.repository.port';
export { CONTACT_TARGET_DIRECTORY } from './application/ports/contact-target-directory.port';
export {
  ContactRequestUnavailableError,
  ContactTargetLookupUnavailableError,
  ContactTargetNotFoundError,
  SelfContactRequestError,
  SendContactRequestUseCase,
} from './application/use-cases/send-contact-request.use-case';
export {
  ContactRelationshipNotFoundError,
  ContactRequestAlreadyAcceptedError,
  ContactRequestAlreadyRejectedError,
} from './application/use-cases/contact-request.errors';
export {
  AcceptContactRequestUseCase,
  ContactRequestAcceptanceNotAuthorizedError,
  ContactRequestAcceptanceUnavailableError,
} from './application/use-cases/accept-contact-request.use-case';
export {
  ContactRequestRejectionNotAuthorizedError,
  ContactRequestRejectionUnavailableError,
  RejectContactRequestUseCase,
} from './application/use-cases/reject-contact-request.use-case';
export type {
  UserProfile,
  UserProfileDirectory,
} from './application/ports/user-profile-directory.port';
export { USER_PROFILE_DIRECTORY } from './application/ports/user-profile-directory.port';
export {
  InvalidContactListCursorError,
  InvalidContactListLimitError,
} from './application/use-cases/contact-list-pagination';
export type {
  IncomingContactRequestItem,
  IncomingContactRequestPage,
} from './application/use-cases/list-incoming-contact-requests.use-case';
export {
  ListIncomingContactRequestsUseCase,
  IncomingContactRequestListingUnavailableError,
} from './application/use-cases/list-incoming-contact-requests.use-case';
export type {
  OutgoingContactRequestItem,
  OutgoingContactRequestPage,
} from './application/use-cases/list-outgoing-contact-requests.use-case';
export {
  ListOutgoingContactRequestsUseCase,
  OutgoingContactRequestListingUnavailableError,
} from './application/use-cases/list-outgoing-contact-requests.use-case';
export type {
  AcceptedContactItem,
  AcceptedContactPage,
} from './application/use-cases/list-accepted-contacts.use-case';
export {
  AcceptedContactListingUnavailableError,
  ListAcceptedContactsUseCase,
} from './application/use-cases/list-accepted-contacts.use-case';
export { ChatPersistenceModule } from './infrastructure/nestjs/chat-persistence.module';
export { CHAT_PRISMA_CLIENT } from './infrastructure/prisma/chat-prisma-client.provider';
