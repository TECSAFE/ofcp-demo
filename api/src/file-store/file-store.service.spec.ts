import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStoreService } from './file-store.service';
import { ConfigService } from '../shared/config/config.service';

describe('FileStoreService', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'filestore-'));
    process.env.DATA_DIR = dir;
  });

  afterEach(async () => {
    delete process.env.DATA_DIR;
    await rm(dir, { recursive: true, force: true });
  });

  it('returns the fallback when the file does not exist', async () => {
    const store = new FileStoreService(new ConfigService());
    expect(await store.read<string[]>('users', [])).toEqual([]);
  });

  it('persists updates and reads them back across instances', async () => {
    const store = new FileStoreService(new ConfigService());
    await store.update<string[]>('users', [], (d) => [...d, 'a']);
    expect(await store.read<string[]>('users', [])).toEqual(['a']);

    const secondInstance = new FileStoreService(new ConfigService());
    expect(await secondInstance.read<string[]>('users', [])).toEqual(['a']);
  });

  it('serializes concurrent updates to the same collection', async () => {
    const store = new FileStoreService(new ConfigService());
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        store.update<number[]>('nums', [], (d) => [...d, i]),
      ),
    );
    expect((await store.read<number[]>('nums', [])).length).toBe(10);
  });
});
