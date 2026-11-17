import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../infrastructure/passport/jwt-auth.guard';
import { CurrentUserDto } from './dto/current-user.dto';
import {
  ApiIdentityErrorResponses,
  UNEXPECTED_FAILURE,
} from './identity-error-responses.decorator';
import { AuthenticatedUser } from '../../infrastructure/passport/jwt.strategy';

@Controller('users')
export class UsersController {
  @Get('me')
  @ApiTags('Current user')
  @ApiOperation({
    description:
      'Transitional: the tier is hardcoded to Free until Billing exists, and a composed current-user endpoint will replace this operation.',
  })
  @ApiBearerAuth()
  @ApiOkResponse({
    type: CurrentUserDto,
    description: 'The authenticated user.',
  })
  @ApiIdentityErrorResponses({
    401: 'The access token is missing, invalid or expired.',
    500: UNEXPECTED_FAILURE,
  })
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
