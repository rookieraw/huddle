import { Module } from '@nestjs/common';
import { RegisterUserUseCase } from './application/use-cases/register-user.use-case';
import {
  USER_REPOSITORY,
  UserRepository,
} from './application/ports/user.repository.port';
import { PrismaUserRepository } from './infrastructure/prisma/prisma-user.repository';
import { prismaClientProvider } from './infrastructure/prisma/prisma-client.provider';
import { IdentityController } from './interface/http/identity.controller';

@Module({
  controllers: [IdentityController],
  providers: [
    prismaClientProvider,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    {
      provide: RegisterUserUseCase,
      useFactory: (repo: UserRepository) => new RegisterUserUseCase(repo),
      inject: [USER_REPOSITORY],
    },
  ],
})
export class IdentityModule {}
