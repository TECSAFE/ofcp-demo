import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStoreService } from '../file-store/file-store.service';
import { ConfigService } from '../shared/config/config.service';
import { SessionService } from './session.service';

describe('SessionService', () => {
  let dir: string;
  let service: SessionService;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'sessions-'));
    process.env.DATA_DIR = dir;
    service = new SessionService(new FileStoreService(new ConfigService()));
  });

  afterEach(async () => {
    delete process.env.DATA_DIR;
    await rm(dir, { recursive: true, force: true });
  });

  it('creates a new session when no sid is given', async () => {
    const session = await service.getOrCreate(undefined);
    expect(session.sid).toBeTruthy();
    expect(session.userId).toBeNull();
  });

  it('returns the same session for a known sid', async () => {
    const created = await service.getOrCreate(undefined);
    const found = await service.getOrCreate(created.sid);
    expect(found.sid).toBe(created.sid);
  });

  it('creates a fresh session for an unknown sid', async () => {
    const session = await service.getOrCreate('does-not-exist');
    expect(session.sid).not.toBe('does-not-exist');
  });

  it('attaches and detaches a user', async () => {
    const created = await service.getOrCreate(undefined);
    await service.setUser(created.sid, 'user-1');
    expect((await service.getOrCreate(created.sid)).userId).toBe('user-1');
    await service.setUser(created.sid, null);
    expect((await service.getOrCreate(created.sid)).userId).toBeNull();
  });

  it('stamps lastSeenAt equal to createdAt on a new session', async () => {
    const session = await service.getOrCreate(undefined);
    expect(session.lastSeenAt).toBe(session.createdAt);
  });

  it('touch() updates lastSeenAt for a known sid', async () => {
    const created = await service.getOrCreate(undefined);
    await service.touch(created.sid, '2099-01-01T00:00:00.000Z');
    const found = await service.getOrCreate(created.sid);
    expect(found.lastSeenAt).toBe('2099-01-01T00:00:00.000Z');
    expect(found.createdAt).toBe(created.createdAt);
  });

  it('touch() is a no-op for an unknown sid', async () => {
    const created = await service.getOrCreate(undefined);
    await service.touch('nope', '2099-01-01T00:00:00.000Z');
    const found = await service.getOrCreate(created.sid);
    expect(found.lastSeenAt).toBe(created.lastSeenAt);
  });
});
