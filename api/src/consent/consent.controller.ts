import {
  Body,
  Controller,
  Get,
  Put,
  UnauthorizedException,
} from '@nestjs/common';
import { ConsentDto } from '../auth/auth.dto';
import { ShopSession } from '../session/session.decorator';
import type { Session } from '../session/session.types';
import { UsersService } from '../users/users.service';

@Controller('consent')
export class ConsentController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async get(@ShopSession() session: Session) {
    if (!session.userId) throw new UnauthorizedException('Login required');
    const user = await this.users.getById(session.userId);
    return { consent: user?.consent ?? null };
  }

  @Put()
  async put(@ShopSession() session: Session, @Body() dto: ConsentDto) {
    if (!session.userId) throw new UnauthorizedException('Login required');
    const consent = {
      ...(dto.version !== undefined ? { version: dto.version } : {}),
      ...(dto.nativeTracking !== undefined
        ? { nativeTracking: dto.nativeTracking }
        : {}),
      dataExchange: dto.dataExchange,
      tracking: dto.tracking,
      updatedAt: dto.updatedAt ?? new Date().toISOString(),
    };
    await this.users.setConsent(session.userId, consent);
    return { consent };
  }
}
