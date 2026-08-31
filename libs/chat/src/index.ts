export type { ContactRelationshipRepository } from './application/ports/contact-relationship.repository.port';
export type { ContactTargetDirectory } from './application/ports/contact-target-directory.port';
export { CONTACT_RELATIONSHIP_REPOSITORY } from './application/ports/contact-relationship.repository.port';
export { CONTACT_TARGET_DIRECTORY } from './application/ports/contact-target-directory.port';
export {
  ContactTargetNotFoundError,
  SelfContactRequestError,
  SendContactRequestUseCase,
} from './application/use-cases/send-contact-request.use-case';
export { ChatPersistenceModule } from './infrastructure/nestjs/chat-persistence.module';
export { CHAT_PRISMA_CLIENT } from './infrastructure/prisma/chat-prisma-client.provider';
