import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStoreService } from '../file-store/file-store.service';
import { ConfigService } from '../shared/config/config.service';
import { WhitelabelService } from './whitelabel.service';
import { WhitelabelShare } from './whitelabel.types';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-07-21T00:00:00.000Z');

const input = {
  settings: {
    shopName: 'ACME Tools',
    primaryColor: '#b91c1c',
    surfaceColor: '#fde68a',
    debugWidget: false,
  },
  logo: { type: 'image/png', base64: 'aGVsbG8=' },
  durationDays: 7,
};

describe('WhitelabelService', () => {
  let dir: string;
  let store: FileStoreService;
  let service: WhitelabelService;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'whitelabel-'));
    process.env.DATA_DIR = dir;
    store = new FileStoreService(new ConfigService());
    service = new WhitelabelService(store);
  });

  afterEach(async () => {
    delete process.env.DATA_DIR;
    await rm(dir, { recursive: true, force: true });
  });

  it('creates a share with id and duration-based expiry and persists it', async () => {
    const share = await service.createShare(input, NOW);
    expect(share.id).toEqual(expect.any(String));
    expect(share.id).not.toBe('');
    expect(share.createdAt).toBe(new Date(NOW).toISOString());
    expect(share.expiresAt).toBe(new Date(NOW + 7 * DAY).toISOString());

    const stored = await store.read<WhitelabelShare[]>('whitelabel-shares', []);
    expect(stored).toEqual([share]);
  });

  it('returns a live share and null for unknown ids', async () => {
    const share = await service.createShare(input, NOW);
    expect(await service.getShare(share.id, NOW + 1000)).toEqual(share);
    expect(await service.getShare('nope', NOW)).toBeNull();
  });

  it('returns null once the share is expired', async () => {
    const share = await service.createShare(input, NOW);
    expect(await service.getShare(share.id, NOW + 7 * DAY - 1000)).toEqual(
      share,
    );
    expect(await service.getShare(share.id, NOW + 7 * DAY + 1000)).toBeNull();
  });

  it('stores shares without a logo', async () => {
    const share = await service.createShare({ ...input, logo: null }, NOW);
    expect((await service.getShare(share.id, NOW))?.logo).toBeNull();
  });

  it('keeps multiple shares side by side', async () => {
    const a = await service.createShare(input, NOW);
    const b = await service.createShare({ ...input, durationDays: 1 }, NOW);
    expect(a.id).not.toBe(b.id);
    const stored = await store.read<WhitelabelShare[]>('whitelabel-shares', []);
    expect(stored.map((s) => s.id).sort()).toEqual([a.id, b.id].sort());
  });
});
