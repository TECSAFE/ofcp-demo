import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStoreService } from '../file-store/file-store.service';
import { ConfigService } from '../shared/config/config.service';
import type { Session } from '../session/session.types';
import type { User } from '../users/user.types';
import type { CartRecord } from '../cart/cart.types';
import type { WhitelabelShare } from '../whitelabel/whitelabel.types';
import { CleanupService } from './cleanup.service';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-07-21T00:00:00.000Z');
const daysAgo = (n: number) => new Date(NOW - n * DAY).toISOString();

describe('CleanupService', () => {
  let dir: string;
  let store: FileStoreService;
  let service: CleanupService;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'cleanup-'));
    process.env.DATA_DIR = dir;
    process.env.GUEST_SESSION_TTL_DAYS = '7';
    process.env.SESSION_TTL_DAYS = '30';
    process.env.USER_TTL_DAYS = '90';
    store = new FileStoreService(new ConfigService());
    service = new CleanupService(store, new ConfigService());
  });

  afterEach(async () => {
    delete process.env.DATA_DIR;
    await rm(dir, { recursive: true, force: true });
  });

  const seed = async () => {
    const sessions: Session[] = [
      {
        sid: 'g1',
        userId: null,
        createdAt: daysAgo(10),
        lastSeenAt: daysAgo(10),
      }, // stale guest
      {
        sid: 'g2',
        userId: null,
        createdAt: daysAgo(2),
        lastSeenAt: daysAgo(2),
      }, // fresh guest
      {
        sid: 'a1',
        userId: 'u1',
        createdAt: daysAgo(200),
        lastSeenAt: daysAgo(3),
      }, // keeps u1 active
      {
        sid: 'a2',
        userId: 'u1',
        createdAt: daysAgo(200),
        lastSeenAt: daysAgo(40),
      }, // stale authed session
      {
        sid: 'a3',
        userId: 'u2',
        createdAt: daysAgo(100),
        lastSeenAt: daysAgo(100),
      }, // sole session of dead user
    ];
    const users: User[] = [
      {
        id: 'u1',
        email: 'a@x.de',
        passwordHash: 'x',
        consent: null,
        createdAt: daysAgo(200),
      },
      {
        id: 'u2',
        email: 'b@x.de',
        passwordHash: 'x',
        consent: null,
        createdAt: daysAgo(100),
      },
    ];
    const carts: CartRecord[] = [
      { sid: 'g2', items: [{ articleNumber: 'A', quantity: 1 }] }, // live session -> kept
      { sid: 'g1', items: [{ articleNumber: 'B', quantity: 1 }] }, // expired session -> orphan
      { sid: 'a3', items: [{ articleNumber: 'C', quantity: 1 }] }, // dead user's session -> orphan
    ];
    const shares: WhitelabelShare[] = [
      {
        id: 'live-share',
        settings: {
          shopName: 'A',
          primaryColor: '#000000',
          surfaceColor: '#ffffff',
          debugWidget: false,
        },
        logo: null,
        createdAt: daysAgo(1),
        expiresAt: new Date(NOW + DAY).toISOString(), // expires tomorrow -> kept
      },
      {
        id: 'dead-share',
        settings: {
          shopName: 'B',
          primaryColor: '#000000',
          surfaceColor: '#ffffff',
          debugWidget: false,
        },
        logo: null,
        createdAt: daysAgo(10),
        expiresAt: daysAgo(3), // expired -> removed
      },
    ];
    await store.update<Session[]>('sessions', [], () => sessions);
    await store.update<User[]>('users', [], () => users);
    await store.update<CartRecord[]>('carts', [], () => carts);
    await store.update<WhitelabelShare[]>(
      'whitelabel-shares',
      [],
      () => shares,
    );
  };

  it('removes expired sessions, cascades dead users, and drops orphaned carts', async () => {
    await seed();
    const summary = await service.runCleanup(NOW);

    expect(summary).toEqual({
      sessionsRemoved: 3,
      usersRemoved: 1,
      cartsRemoved: 2,
      sharesRemoved: 1,
    });

    const sessions = await store.read<Session[]>('sessions', []);
    expect(sessions.map((s) => s.sid).sort()).toEqual(['a1', 'g2']);

    const users = await store.read<User[]>('users', []);
    expect(users.map((u) => u.id)).toEqual(['u1']);

    const carts = await store.read<CartRecord[]>('carts', []);
    expect(carts.map((c) => c.sid)).toEqual(['g2']);

    const shares = await store.read<WhitelabelShare[]>('whitelabel-shares', []);
    expect(shares.map((s) => s.id)).toEqual(['live-share']);
  });

  it('removes nothing when everything is fresh', async () => {
    await store.update<Session[]>('sessions', [], () => [
      { sid: 'g', userId: null, createdAt: daysAgo(1), lastSeenAt: daysAgo(1) },
    ]);
    const summary = await service.runCleanup(NOW);
    expect(summary).toEqual({
      sessionsRemoved: 0,
      usersRemoved: 0,
      cartsRemoved: 0,
      sharesRemoved: 0,
    });
    expect((await store.read<Session[]>('sessions', [])).length).toBe(1);
  });
});
