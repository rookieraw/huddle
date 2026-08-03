import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client';

export const prismaClientProvider: Provider = {
  provide: PrismaClient,
  useFactory: (configService: ConfigService) => {
    const connectionString = configService.get<string>('DATABASE_URL');
    const adapter = new PrismaPg({ connectionString });
    return new PrismaClient({ adapter });
  },
  inject: [ConfigService],
};
