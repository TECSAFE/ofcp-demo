import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ShopSession } from '../session/session.decorator';
import type { Session } from '../session/session.types';
import { UsersService } from '../users/users.service';
import { TokenRequestDto } from './tecsafe.dto';
import { TecsafeService } from './tecsafe.service';

@Controller('tecsafe')
export class TecsafeController {
  constructor(
    private readonly tecsafe: TecsafeService,
    private readonly users: UsersService,
  ) {}

  @Post('token')
  @HttpCode(200)
  async token(@ShopSession() session: Session, @Body() dto: TokenRequestDto) {
    const user = session.userId
      ? await this.users.getById(session.userId)
      : null;
    const token = await this.tecsafe.exchangeCustomerToken(
      dto.oldToken,
      user ? { id: user.id, email: user.email } : null,
    );
    return { token };
  }
}
