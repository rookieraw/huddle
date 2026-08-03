import type { Request } from 'express';
import { AuthenticatedUser } from '../../infrastructure/passport/jwt.strategy';
import { UsersController } from './users.controller';

function buildRequest(user: AuthenticatedUser): Request {
  return { user } as unknown as Request;
}

describe('UsersController', () => {
  describe('me', () => {
    it('returns the authenticated user id, email, and a hardcoded free tier', () => {
      const controller = new UsersController();
      const req = buildRequest({ id: 'user-123', email: 'ada@example.com' });

      const result = controller.me(req);

      expect(result).toEqual({
        id: 'user-123',
        email: 'ada@example.com',
        tier: 'free',
      });
    });
  });
});
