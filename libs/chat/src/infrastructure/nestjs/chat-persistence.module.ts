import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { chatPrismaClientProvider } from '../prisma/chat-prisma-client.provider';

@Module({
  imports: [ConfigModule],
  providers: [chatPrismaClientProvider],
})
export class ChatPersistenceModule {}
