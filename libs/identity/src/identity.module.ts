import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RegisterUserUseCase } from './application/use-cases/register-user.use-case';
import { LoginUserUseCase } from './application/use-cases/login-user.use-case';
import { VerifyEmailUseCase } from './application/use-cases/verify-email.use-case';
import { IssueRefreshTokenUseCase } from './application/use-cases/issue-refresh-token.use-case';
import { RefreshTokenUseCase } from './application/use-cases/refresh-token.use-case';
import { OAuthLoginUseCase } from './application/use-cases/oauth-login.use-case';
import { IssueAuthTokensUseCase } from './application/use-cases/issue-auth-tokens.use-case';
import {
  USER_REPOSITORY,
  UserRepository,
} from './application/ports/user.repository.port';
import {
  REFRESH_TOKEN_REPOSITORY,
  RefreshTokenRepository,
} from './application/ports/refresh-token.repository.port';
import {
  TOKEN_ISSUER,
  TokenIssuer,
} from './application/ports/token-issuer.port';
import { PrismaUserRepository } from './infrastructure/prisma/prisma-user.repository';
import { PrismaRefreshTokenRepository } from './infrastructure/prisma/prisma-refresh-token.repository';
import { prismaClientProvider } from './infrastructure/prisma/prisma-client.provider';
import { JwtTokenIssuer } from './infrastructure/jwt/jwt-token-issuer';
import { GoogleStrategy } from './infrastructure/passport/google.strategy';
import { GithubStrategy } from './infrastructure/passport/github.strategy';
import { GoogleAuthGuard } from './infrastructure/passport/google-auth.guard';
import { GithubAuthGuard } from './infrastructure/passport/github-auth.guard';
import { IdentityController } from './interface/http/identity.controller';

@Module({
  imports: [
    PassportModule,
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
    { provide: TOKEN_ISSUER, useClass: JwtTokenIssuer },
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
    {
      provide: OAuthLoginUseCase,
      useFactory: (repo: UserRepository) => new OAuthLoginUseCase(repo),
      inject: [USER_REPOSITORY],
    },
    {
      provide: IssueAuthTokensUseCase,
      useFactory: (
        tokenIssuer: TokenIssuer,
        issueRefreshTokenUseCase: IssueRefreshTokenUseCase,
      ) => new IssueAuthTokensUseCase(tokenIssuer, issueRefreshTokenUseCase),
      inject: [TOKEN_ISSUER, IssueRefreshTokenUseCase],
    },
    GoogleStrategy,
    GithubStrategy,
    GoogleAuthGuard,
    GithubAuthGuard,
  ],
})
export class IdentityModule {}
