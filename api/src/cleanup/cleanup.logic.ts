import { Session } from '../session/session.types';
import { User } from '../users/user.types';
import { CleanupPlan, CleanupTtls } from './cleanup.types';

/**
 * Pure expiry policy. Decides which users and sessions have outlived their
 * TTL, measured from last activity (falling back to createdAt for records
 * written before lastSeenAt existed). No I/O, so it is trivially testable.
 *
 * A user's activity is the most recent activity across their sessions, never
 * older than their account creation. Sessions of an expired user are always
 * removed; a surviving user's individual sessions still expire on their own
 * inactivity.
 */
export function computeCleanup(
  now: number,
  sessions: Session[],
  users: User[],
  ttls: CleanupTtls,
): CleanupPlan {
  const lastSeenMs = (s: Session): number =>
    Date.parse(s.lastSeenAt ?? s.createdAt);

  const activityByUser = new Map<string, number>();
  for (const s of sessions) {
    if (!s.userId) continue;
    const t = lastSeenMs(s);
    if (!Number.isFinite(t)) continue;
    activityByUser.set(
      s.userId,
      Math.max(activityByUser.get(s.userId) ?? 0, t),
    );
  }

  const expiredUserIds = users
    .filter((u) => {
      const last = Math.max(
        activityByUser.get(u.id) ?? 0,
        Date.parse(u.createdAt),
      );
      return now - last > ttls.userMs;
    })
    .map((u) => u.id);
  const expiredUsers = new Set(expiredUserIds);

  const expiredSessionSids = sessions
    .filter((s) => {
      if (s.userId && expiredUsers.has(s.userId)) return true;
      const ttl = s.userId ? ttls.authedSessionMs : ttls.guestSessionMs;
      return now - lastSeenMs(s) > ttl;
    })
    .map((s) => s.sid);

  return { expiredUserIds, expiredSessionSids };
}
