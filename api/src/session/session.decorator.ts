import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestWithSession, Session } from './session.types';

export const ShopSession = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Session =>
    ctx.switchToHttp().getRequest<RequestWithSession>().shopSession,
);
