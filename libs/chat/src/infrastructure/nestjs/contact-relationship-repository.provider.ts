import type { Provider } from '@nestjs/common';
import { CONTACT_RELATIONSHIP_REPOSITORY } from '../../application/ports/contact-relationship.repository.port';
import { CHAT_PRISMA_CLIENT } from '../prisma/chat-prisma-client.provider';
import { PrismaClient } from '../prisma/generated/client';
import { PrismaContactRelationshipRepository } from '../prisma/prisma-contact-relationship.repository';

export const contactRelationshipRepositoryProvider: Provider = {
  provide: CONTACT_RELATIONSHIP_REPOSITORY,
  useFactory: (prisma: PrismaClient) =>
    new PrismaContactRelationshipRepository(prisma),
  inject: [CHAT_PRISMA_CLIENT],
};
