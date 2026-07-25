import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RegisterUserUseCase } from './application/use-cases/register-user.use-case';
import { LoginUserUseCase } from './application/use-cases/login-user.use-case';
import {
  USER_REPOSITORY,
  UserRepository,
} from './application/ports/user.repository.port';
import { PrismaUserRepository } from './infrastructure/prisma/prisma-user.repository';
import { prismaClientProvider } from './infrastructure/prisma/prisma-client.provider';
import { IdentityController } from './interface/http/identity.controller';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [IdentityController],
  providers: [
    prismaClientProvider,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    {
      provide: RegisterUserUseCase,
      useFactory: (repo: UserRepository) => new RegisterUserUseCase(repo),
      inject: [USER_REPOSITORY],
    },
    {
      provide: LoginUserUseCase,
      useFactory: (repo: UserRepository) => new LoginUserUseCase(repo),
      inject: [USER_REPOSITORY],
    },
  ],
})
export class IdentityModule {}
