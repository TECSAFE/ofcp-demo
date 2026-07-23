import type { Session } from '../session/session.types';
import type { User } from '../users/user.types';
import { computeCleanup } from './cleanup.logic';
import { CleanupTtls } from './cleanup.types';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-07-21T00:00:00.000Z');
const daysAgo = (n: number) => new Date(NOW - n * DAY).toISOString();

const ttls: CleanupTtls = {
  guestSessionMs: 7 * DAY,
  authedSessionMs: 30 * DAY,
  userMs: 90 * DAY,
};

const session = (over: Partial<Session>): Session => ({
  sid: 's',
  userId: null,
  createdAt: daysAgo(0),
  lastSeenAt: daysAgo(0),
  ...over,
});

const user = (over: Partial<User>): User => ({
  id: 'u',
  email: 'u@example.com',
  passwordHash: 'x',
  consent: null,
  createdAt: daysAgo(0),
  ...over,
});

describe('computeCleanup', () => {
  it('expires a guest session idle past the guest TTL and keeps a fresh one', () => {
    const plan = computeCleanup(
      NOW,
      [
        session({ sid: 'old', lastSeenAt: daysAgo(10) }),
        session({ sid: 'new', lastSeenAt: daysAgo(2) }),
      ],
      [],
      ttls,
    );
    expect(plan.expiredSessionSids).toEqual(['old']);
  });

  it('applies the longer authed TTL to logged-in sessions', () => {
    // 20 days idle: past the 7-day guest TTL but within the 30-day authed TTL.
    const plan = computeCleanup(
      NOW,
      [session({ sid: 'a', userId: 'u1', lastSeenAt: daysAgo(20) })],
      [user({ id: 'u1', createdAt: daysAgo(20) })],
      ttls,
    );
    expect(plan.expiredSessionSids).toEqual([]);
    expect(plan.expiredUserIds).toEqual([]);
  });

  it('cascades: an inactive user and their sole (old) session both expire', () => {
    const plan = computeCleanup(
      NOW,
      [session({ sid: 'a', userId: 'u1', lastSeenAt: daysAgo(100) })],
      [user({ id: 'u1', createdAt: daysAgo(120) })],
      ttls,
    );
    expect(plan.expiredUserIds).toEqual(['u1']);
    expect(plan.expiredSessionSids).toEqual(['a']);
  });

  it('keeps a user active on any session, but still expires their stale sessions', () => {
    const plan = computeCleanup(
      NOW,
      [
        session({ sid: 'fresh', userId: 'u1', lastSeenAt: daysAgo(3) }),
        session({ sid: 'stale', userId: 'u1', lastSeenAt: daysAgo(40) }),
      ],
      [user({ id: 'u1', createdAt: daysAgo(200) })],
      ttls,
    );
    expect(plan.expiredUserIds).toEqual([]);
    expect(plan.expiredSessionSids).toEqual(['stale']);
  });

  it('cascade removes a session within its own TTL when its user has expired', () => {
    // userMs < authedSessionMs, so this exercises the cascade branch specifically:
    // session 'a' at 10d is INSIDE the 30d authed TTL, yet u1 is inactive beyond
    // the 5d user TTL, so 'a' is removed only because its user expired.
    const cascadeTtls: CleanupTtls = {
      guestSessionMs: 7 * DAY,
      authedSessionMs: 30 * DAY,
      userMs: 5 * DAY,
    };
    const plan = computeCleanup(
      NOW,
      [session({ sid: 'a', userId: 'u1', lastSeenAt: daysAgo(10) })],
      [user({ id: 'u1', createdAt: daysAgo(10) })],
      cascadeTtls,
    );
    expect(plan.expiredUserIds).toEqual(['u1']);
    expect(plan.expiredSessionSids).toEqual(['a']);
  });

  it('expires a user with no sessions once account age exceeds userMs', () => {
    const plan = computeCleanup(
      NOW,
      [],
      [user({ id: 'u1', createdAt: daysAgo(100) })],
      ttls,
    );
    expect(plan.expiredUserIds).toEqual(['u1']);
    expect(plan.expiredSessionSids).toEqual([]);
  });

  it('falls back to createdAt when lastSeenAt is missing (legacy records)', () => {
    const legacy = {
      sid: 'legacy',
      userId: null,
      createdAt: daysAgo(10),
    } as Session;
    const plan = computeCleanup(NOW, [legacy], [], ttls);
    expect(plan.expiredSessionSids).toEqual(['legacy']);
  });
});
