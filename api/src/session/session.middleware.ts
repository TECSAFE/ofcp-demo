import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { SessionService } from './session.service';
import { RequestWithSession } from './session.types';

/** How stale a session's lastSeenAt must be before we rewrite it. Avoids a
 *  file write on every single request while keeping activity roughly current. */
const TOUCH_THRESHOLD_MS = 60_000;

@Injectable()
export class SessionMiddleware implements NestMiddleware {
  constructor(private readonly sessions: SessionService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const sid = (req.cookies as Record<string, string> | undefined)?.sid;
    const session = await this.sessions.getOrCreate(sid);
    if (session.sid !== sid) {
      res.cookie('sid', session.sid, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 30 * 24 * 3600 * 1000,
      });
    } else {
      const lastSeen = Date.parse(session.lastSeenAt ?? session.createdAt);
      if (
        Number.isFinite(lastSeen) &&
        Date.now() - lastSeen > TOUCH_THRESHOLD_MS
      ) {
        await this.sessions.touch(session.sid);
      }
    }
    (req as RequestWithSession).shopSession = session;
    next();
  }
}
