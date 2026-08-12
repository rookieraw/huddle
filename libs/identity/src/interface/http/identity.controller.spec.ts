import type { Request } from 'express';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DomainError } from '@huddle/shared-kernel';
import { User } from '../../domain/user.entity';
import { DisplayName } from '../../domain/value-objects/display-name.vo';
import { RegisterUserUseCase } from '../../application/use-cases/register-user.use-case';
import { LoginUserUseCase } from '../../application/use-cases/login-user.use-case';
import { VerifyEmailUseCase } from '../../application/use-cases/verify-email.use-case';
import { RefreshTokenUseCase } from '../../application/use-cases/refresh-token.use-case';
import { IssueAuthTokensUseCase } from '../../application/use-cases/issue-auth-tokens.use-case';
import { LogoutUseCase } from '../../application/use-cases/logout.use-case';
import { AuthenticatedUser } from '../../infrastructure/passport/jwt.strategy';
import { IdentityController } from './identity.controller';

interface ControllerOverrides {
  registerUserUseCase?: { execute: jest.Mock };
  loginUserUseCase?: { execute: jest.Mock };
  verifyEmailUseCase?: { execute: jest.Mock };
  refreshTokenUseCase?: { execute: jest.Mock };
  issueAuthTokensUseCase?: { execute: jest.Mock };
  logoutUseCase?: { execute: jest.Mock };
}

function buildController(
  overrides: ControllerOverrides = {},
): IdentityController {
  return new IdentityController(
    (overrides.registerUserUseCase ??
      ({ execute: jest.fn() } as unknown)) as RegisterUserUseCase,
    (overrides.loginUserUseCase ??
      ({ execute: jest.fn() } as unknown)) as LoginUserUseCase,
    (overrides.verifyEmailUseCase ??
      ({ execute: jest.fn() } as unknown)) as VerifyEmailUseCase,
    (overrides.refreshTokenUseCase ??
      ({ execute: jest.fn() } as unknown)) as RefreshTokenUseCase,
    (overrides.issueAuthTokensUseCase ??
      ({ execute: jest.fn() } as unknown)) as IssueAuthTokensUseCase,
    (overrides.logoutUseCase ??
      ({ execute: jest.fn() } as unknown)) as LogoutUseCase,
    {} as JwtService,
  );
}

function buildRequest(user: AuthenticatedUser): Request {
  return { user } as unknown as Request;
}

async function createVerifiedUser(): Promise<User> {
  const { user } = await User.register(
    'ada@example.com',
    'correct-horse-battery',
    DisplayName.create('Ada Lovelace'),
  );
  user.verifyEmail();
  return user;
}

describe('IdentityController', () => {
  describe('register', () => {
    it('returns id, email, displayName, and verificationToken on success', async () => {
      const { user } = await User.register(
        'ada@example.com',
        'correct-horse-battery',
        DisplayName.create('Ada Lovelace'),
      );
      const registerUserUseCase = {
        execute: jest.fn().mockResolvedValue({ user, event: {} }),
      };
      const controller = buildController({ registerUserUseCase });

      const result = await controller.register({
        email: 'ada@example.com',
        password: 'correct-horse-battery',
        displayName: 'Ada Lovelace',
      });

      expect(registerUserUseCase.execute).toHaveBeenCalledWith(
        'ada@example.com',
        'correct-horse-battery',
        'Ada Lovelace',
      );
      expect(result).toEqual({
        id: user.id,
        email: 'ada@example.com',
        displayName: 'Ada Lovelace',
        verificationToken: user.getVerificationToken(),
      });
    });

    it('maps a DomainError to ConflictException', async () => {
      const registerUserUseCase = {
        execute: jest
          .fn()
          .mockRejectedValue(new DomainError('Email already registered')),
      };
      const controller = buildController({ registerUserUseCase });

      await expect(
        controller.register({
          email: 'ada@example.com',
          password: 'correct-horse-battery',
          displayName: 'Ada Lovelace',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rethrows a non-DomainError unchanged', async () => {
      const unexpected = new Error('database unreachable');
      const registerUserUseCase = {
        execute: jest.fn().mockRejectedValue(unexpected),
      };
      const controller = buildController({ registerUserUseCase });

      await expect(
        controller.register({
          email: 'ada@example.com',
          password: 'correct-horse-battery',
          displayName: 'Ada Lovelace',
        }),
      ).rejects.toBe(unexpected);
    });
  });

  describe('login', () => {
    it('returns the token pair from issueAuthTokensUseCase', async () => {
      const user = await createVerifiedUser();
      const loginUserUseCase = { execute: jest.fn().mockResolvedValue(user) };
      const issueAuthTokensUseCase = {
        execute: jest.fn().mockResolvedValue({
          accessToken: 'a-token',
          refreshToken: 'r-token',
        }),
      };
      const controller = buildController({
        loginUserUseCase,
        issueAuthTokensUseCase,
      });

      const result = await controller.login({
        email: 'ada@example.com',
        password: 'correct-horse-battery',
      });

      expect(loginUserUseCase.execute).toHaveBeenCalledWith(
        'ada@example.com',
        'correct-horse-battery',
      );
      expect(issueAuthTokensUseCase.execute).toHaveBeenCalledWith(user);
      expect(result).toEqual({
        accessToken: 'a-token',
        refreshToken: 'r-token',
      });
    });

    it('maps a DomainError to UnauthorizedException', async () => {
      const loginUserUseCase = {
        execute: jest
          .fn()
          .mockRejectedValue(new DomainError('Invalid email or password')),
      };
      const controller = buildController({ loginUserUseCase });

      await expect(
        controller.login({ email: 'ada@example.com', password: 'wrong' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('verify', () => {
    it('returns id, email, and verified: true on success', async () => {
      const user = await createVerifiedUser();
      const verifyEmailUseCase = { execute: jest.fn().mockResolvedValue(user) };
      const controller = buildController({ verifyEmailUseCase });

      const result = await controller.verify('some-token');

      expect(verifyEmailUseCase.execute).toHaveBeenCalledWith('some-token');
      expect(result).toEqual({
        id: user.id,
        email: 'ada@example.com',
        verified: true,
      });
    });

    it('maps a DomainError to BadRequestException', async () => {
      const verifyEmailUseCase = {
        execute: jest
          .fn()
          .mockRejectedValue(
            new DomainError('Invalid or expired verification token'),
          ),
      };
      const controller = buildController({ verifyEmailUseCase });

      await expect(controller.verify('bad-token')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('refresh', () => {
    it('returns the rotated token pair on success', async () => {
      const refreshTokenUseCase = {
        execute: jest.fn().mockResolvedValue({
          accessToken: 'a-token',
          refreshToken: 'r-token',
        }),
      };
      const controller = buildController({ refreshTokenUseCase });

      const result = await controller.refresh({ refreshToken: 'old-token' });

      expect(refreshTokenUseCase.execute).toHaveBeenCalledWith('old-token');
      expect(result).toEqual({
        accessToken: 'a-token',
        refreshToken: 'r-token',
      });
    });

    it('maps a DomainError to UnauthorizedException', async () => {
      const refreshTokenUseCase = {
        execute: jest
          .fn()
          .mockRejectedValue(new DomainError('Invalid refresh token')),
      };
      const controller = buildController({ refreshTokenUseCase });

      await expect(
        controller.refresh({ refreshToken: 'bad-token' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('delegates to logoutUseCase with the authenticated user id', async () => {
      const logoutUseCase = { execute: jest.fn().mockResolvedValue(undefined) };
      const controller = buildController({ logoutUseCase });
      const req = buildRequest({ id: 'user-123', email: 'ada@example.com' });

      await controller.logout(req, { refreshToken: 'some-token' });

      expect(logoutUseCase.execute).toHaveBeenCalledWith(
        'user-123',
        'some-token',
      );
    });

    it('maps a DomainError to UnauthorizedException', async () => {
      const logoutUseCase = {
        execute: jest
          .fn()
          .mockRejectedValue(new DomainError('Invalid refresh token')),
      };
      const controller = buildController({ logoutUseCase });
      const req = buildRequest({ id: 'user-123', email: 'ada@example.com' });

      await expect(
        controller.logout(req, { refreshToken: 'someone-elses-token' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
