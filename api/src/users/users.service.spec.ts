import { ConflictException } from '@nestjs/common';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStoreService } from '../file-store/file-store.service';
import { ConfigService } from '../shared/config/config.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let dir: string;
  let service: UsersService;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'users-'));
    process.env.DATA_DIR = dir;
    service = new UsersService(new FileStoreService(new ConfigService()));
  });

  afterEach(async () => {
    delete process.env.DATA_DIR;
    await rm(dir, { recursive: true, force: true });
  });

  const consent = {
    dataExchange: true,
    tracking: false,
    updatedAt: '2026-07-20T00:00:00.000Z',
  };

  it('registers a user and stores the handed-in guest consent', async () => {
    const user = await service.register('jane@example.com', 'secret1', consent);
    expect(user).toEqual({
      id: expect.any(String) as unknown,
      email: 'jane@example.com',
    });
    const stored = await service.getById(user.id);
    expect(stored?.consent).toEqual(consent);
    expect(stored?.passwordHash).not.toContain('secret1');
  });

  it('rejects duplicate emails case-insensitively', async () => {
    await service.register('jane@example.com', 'secret1', null);
    await expect(
      service.register('JANE@example.com', 'other', null),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('verifies credentials', async () => {
    const user = await service.register('jane@example.com', 'secret1', null);
    expect(await service.verify('jane@example.com', 'secret1')).toEqual(user);
    expect(await service.verify('jane@example.com', 'wrong')).toBeNull();
    expect(await service.verify('nobody@example.com', 'secret1')).toBeNull();
  });

  it('updates consent', async () => {
    const user = await service.register('jane@example.com', 'secret1', null);
    await service.setConsent(user.id, consent);
    expect((await service.getById(user.id))?.consent).toEqual(consent);
  });
});
