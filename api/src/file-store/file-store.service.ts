import { Injectable } from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ConfigService } from '../shared/config/config.service';

/**
 * JSON-file-per-collection store. No real database by design (demo project).
 * Writes to the same collection are serialized through a per-collection
 * promise chain so concurrent updates cannot lose data.
 */
@Injectable()
export class FileStoreService {
  private readonly chains = new Map<string, Promise<unknown>>();

  constructor(private readonly config: ConfigService) {}

  private get dataDir(): string {
    return this.config.DATA_DIR;
  }

  private fileFor(collection: string): string {
    return join(this.dataDir, `${collection}.json`);
  }

  async read<T>(collection: string, fallback: T): Promise<T> {
    try {
      return JSON.parse(await readFile(this.fileFor(collection), 'utf8')) as T;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
      throw err;
    }
  }

  async update<T>(
    collection: string,
    fallback: T,
    mutate: (data: T) => T,
  ): Promise<T> {
    const prev = this.chains.get(collection) ?? Promise.resolve();
    const next = prev.then(async () => {
      const data = await this.read(collection, fallback);
      const mutated = mutate(data);
      await mkdir(this.dataDir, { recursive: true });
      await writeFile(
        this.fileFor(collection),
        JSON.stringify(mutated, null, 2),
        'utf8',
      );
      return mutated;
    });
    this.chains.set(
      collection,
      next.catch(() => undefined),
    );
    return next;
  }
}
