import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ShopSession } from '../session/session.decorator';
import { SessionService } from '../session/session.service';
import type { Session } from '../session/session.types';
import { UsersService } from '../users/users.service';
import { LoginDto, RegisterDto } from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly users: UsersService,
    private readonly sessions: SessionService,
  ) {}

  @Post('register')
  async register(@ShopSession() session: Session, @Body() dto: RegisterDto) {
    const consent = dto.consent
      ? {
          ...(dto.consent.version !== undefined
            ? { version: dto.consent.version }
            : {}),
          ...(dto.consent.nativeTracking !== undefined
            ? { nativeTracking: dto.consent.nativeTracking }
            : {}),
          dataExchange: dto.consent.dataExchange,
          tracking: dto.consent.tracking,
          updatedAt: dto.consent.updatedAt ?? new Date().toISOString(),
        }
      : null;
    const user = await this.users.register(dto.email, dto.password, consent);
    await this.sessions.setUser(session.sid, user.id);
    return { user };
  }

  @Post('login')
  @HttpCode(200)
  async login(@ShopSession() session: Session, @Body() dto: LoginDto) {
    const user = await this.users.verify(dto.email, dto.password);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    await this.sessions.setUser(session.sid, user.id);
    return { user };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@ShopSession() session: Session) {
    await this.sessions.setUser(session.sid, null);
    return { user: null };
  }

  @Get('me')
  async me(@ShopSession() session: Session) {
    const user = session.userId
      ? await this.users.getById(session.userId)
      : null;
    return { user: user ? { id: user.id, email: user.email } : null };
  }
}
