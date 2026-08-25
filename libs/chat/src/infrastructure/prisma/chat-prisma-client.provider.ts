import type { OnModuleDestroy, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client';

export const CHAT_PRISMA_CLIENT = Symbol('CHAT_PRISMA_CLIENT');

class ManagedChatPrismaClient extends PrismaClient implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

export const chatPrismaClientProvider: Provider = {
  provide: CHAT_PRISMA_CLIENT,
  useFactory: (configService: ConfigService) => {
    const connectionString = configService.get<string>('DATABASE_URL');
    const adapter = new PrismaPg({ connectionString });

    return new ManagedChatPrismaClient({ adapter });
  },
  inject: [ConfigService],
};
