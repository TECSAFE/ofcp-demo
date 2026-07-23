import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ConfigService } from '../shared/config/config.service';
import { FileStoreService } from '../file-store/file-store.service';
import { Session } from '../session/session.types';
import { User } from '../users/user.types';
import { CartRecord } from '../cart/cart.types';
import { isShareExpired } from '../whitelabel/whitelabel.logic';
import { WhitelabelShare } from '../whitelabel/whitelabel.types';
import { computeCleanup } from './cleanup.logic';
import { CleanupSummary, CleanupTtls } from './cleanup.types';

const DAY_MS = 24 * 60 * 60 * 1000;
export const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // hourly

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(
    private readonly store: FileStoreService,
    private readonly config: ConfigService,
  ) {}

  private ttls(): CleanupTtls {
    return {
      guestSessionMs: this.config.GUEST_SESSION_TTL_DAYS * DAY_MS,
      authedSessionMs: this.config.SESSION_TTL_DAYS * DAY_MS,
      userMs: this.config.USER_TTL_DAYS * DAY_MS,
    };
  }

  @Interval('session-cleanup', CLEANUP_INTERVAL_MS)
  async runCleanup(now: number = Date.now()): Promise<CleanupSummary> {
    const sessions = await this.store.read<Session[]>('sessions', []);
    const users = await this.store.read<User[]>('users', []);
    const plan = computeCleanup(now, sessions, users, this.ttls());

    const removedSids = new Set(plan.expiredSessionSids);
    const removedUsers = new Set(plan.expiredUserIds);

    if (removedSids.size) {
      await this.store.update<Session[]>('sessions', [], (data) =>
        data.filter((s) => !removedSids.has(s.sid)),
      );
    }
    if (removedUsers.size) {
      await this.store.update<User[]>('users', [], (data) =>
        data.filter((u) => !removedUsers.has(u.id)),
      );
    }

    // Carts are keyed only by sid. Re-read the sessions we just pruned so a
    // cart created concurrently (new session) is not mistaken for an orphan.
    const liveSids = new Set(
      (await this.store.read<Session[]>('sessions', [])).map((s) => s.sid),
    );
    let cartsRemoved = 0;
    await this.store.update<CartRecord[]>('carts', [], (data) => {
      const kept = data.filter((c) => liveSids.has(c.sid));
      cartsRemoved = data.length - kept.length;
      return kept;
    });

    // Whitelabel shares carry an explicit expiry; drop the ones past it.
    let sharesRemoved = 0;
    await this.store.update<WhitelabelShare[]>(
      'whitelabel-shares',
      [],
      (data) => {
        const kept = data.filter((s) => !isShareExpired(s, now));
        sharesRemoved = data.length - kept.length;
        return kept;
      },
    );

    const summary: CleanupSummary = {
      sessionsRemoved: removedSids.size,
      usersRemoved: removedUsers.size,
      cartsRemoved,
      sharesRemoved,
    };
    if (
      summary.sessionsRemoved ||
      summary.usersRemoved ||
      summary.cartsRemoved ||
      summary.sharesRemoved
    ) {
      this.logger.log(
        `removed ${summary.sessionsRemoved} sessions, ` +
          `${summary.usersRemoved} users, ${summary.cartsRemoved} carts, ` +
          `${summary.sharesRemoved} whitelabel shares`,
      );
    }
    return summary;
  }
}
