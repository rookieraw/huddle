import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../infrastructure/passport/jwt-auth.guard';
import { AuthenticatedUser } from '../../infrastructure/passport/jwt.strategy';

@Controller('users')
export class UsersController {
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request) {
    const user = req.user as AuthenticatedUser;
    return {
      id: user.id,
      email: user.email,
      // TODO(billing): replace once Subscription/Tier exist — Billing (Phase 4)
      // owns this concept, hardcoded until then.
      tier: 'free',
    };
  }
}
