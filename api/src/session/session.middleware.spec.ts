import { SessionMiddleware } from './session.middleware';
import type { Session } from './session.types';

const makeSession = (over: Partial<Session> = {}): Session => ({
  sid: 's1',
  userId: null,
  createdAt: new Date().toISOString(),
  lastSeenAt: new Date().toISOString(),
  ...over,
});

const runWith = async (session: Session, cookieSid: string | undefined) => {
  const touch = jest.fn().mockResolvedValue(undefined);
  const getOrCreate = jest.fn().mockResolvedValue(session);
  const mw = new SessionMiddleware({ getOrCreate, touch } as never);
  const req = { cookies: cookieSid ? { sid: cookieSid } : {} } as never;
  const res = { cookie: jest.fn() } as never;
  const next = jest.fn();
  await mw.use(req, res, next);
  return { touch, res, next };
};

describe('SessionMiddleware', () => {
  it('touches an existing session that has gone stale', async () => {
    const stale = new Date(Date.now() - 5 * 60_000).toISOString();
    const { touch, next } = await runWith(
      makeSession({ sid: 's1', lastSeenAt: stale }),
      's1',
    );
    expect(touch).toHaveBeenCalledWith('s1');
    expect(next).toHaveBeenCalled();
  });

  it('does not touch a session seen within the threshold', async () => {
    const { touch } = await runWith(
      makeSession({ sid: 's1', lastSeenAt: new Date().toISOString() }),
      's1',
    );
    expect(touch).not.toHaveBeenCalled();
  });

  it('issues a cookie and skips touch for a brand-new session', async () => {
    const { touch, res } = await runWith(
      makeSession({ sid: 'new' }),
      undefined,
    );
    expect(
      (res as unknown as { cookie: jest.Mock }).cookie,
    ).toHaveBeenCalledWith(
      'sid',
      'new',
      expect.objectContaining({ httpOnly: true }),
    );
    expect(touch).not.toHaveBeenCalled();
  });
});
