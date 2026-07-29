import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RegisterUserUseCase } from './application/use-cases/register-user.use-case';
import { LoginUserUseCase } from './application/use-cases/login-user.use-case';
import { VerifyEmailUseCase } from './application/use-cases/verify-email.use-case';
import { IssueRefreshTokenUseCase } from './application/use-cases/issue-refresh-token.use-case';
import { RefreshTokenUseCase } from './application/use-cases/refresh-token.use-case';
import {
  USER_REPOSITORY,
  UserRepository,
} from './application/ports/user.repository.port';
import {
  REFRESH_TOKEN_REPOSITORY,
  RefreshTokenRepository,
} from './application/ports/refresh-token.repository.port';
import { PrismaUserRepository } from './infrastructure/prisma/prisma-user.repository';
import { PrismaRefreshTokenRepository } from './infrastructure/prisma/prisma-refresh-token.repository';
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
      provide: REFRESH_TOKEN_REPOSITORY,
      useClass: PrismaRefreshTokenRepository,
    },
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
    {
      provide: VerifyEmailUseCase,
      useFactory: (repo: UserRepository) => new VerifyEmailUseCase(repo),
      inject: [USER_REPOSITORY],
    },
    {
      provide: IssueRefreshTokenUseCase,
      useFactory: (repo: RefreshTokenRepository) =>
        new IssueRefreshTokenUseCase(repo),
      inject: [REFRESH_TOKEN_REPOSITORY],
    },
    {
      provide: RefreshTokenUseCase,
      useFactory: (repo: RefreshTokenRepository) =>
        new RefreshTokenUseCase(repo),
      inject: [REFRESH_TOKEN_REPOSITORY],
    },
  ],
})
export class IdentityModule {}
