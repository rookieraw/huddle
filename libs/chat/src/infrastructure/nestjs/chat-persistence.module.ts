import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CONTACT_RELATIONSHIP_REPOSITORY } from '../../application/ports/contact-relationship.repository.port';
import { chatPrismaClientProvider } from '../prisma/chat-prisma-client.provider';
import { contactRelationshipRepositoryProvider } from './contact-relationship-repository.provider';

@Module({
  imports: [ConfigModule],
  providers: [chatPrismaClientProvider, contactRelationshipRepositoryProvider],
  exports: [CONTACT_RELATIONSHIP_REPOSITORY],
})
export class ChatPersistenceModule {}
