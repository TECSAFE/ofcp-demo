import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { FileStoreService } from '../file-store/file-store.service';
import { isShareExpired } from './whitelabel.logic';
import {
  WhitelabelShare,
  WhitelabelShareLogo,
  WhitelabelShareSettings,
} from './whitelabel.types';

const DAY_MS = 24 * 60 * 60 * 1000;
const COLLECTION = 'whitelabel-shares';

export type CreateShareInput = {
  settings: WhitelabelShareSettings;
  logo: WhitelabelShareLogo | null;
  durationDays: number;
};

@Injectable()
export class WhitelabelService {
  constructor(private readonly store: FileStoreService) {}

  async createShare(
    input: CreateShareInput,
    now: number = Date.now(),
  ): Promise<WhitelabelShare> {
    const share: WhitelabelShare = {
      id: randomUUID(),
      settings: input.settings,
      logo: input.logo,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + input.durationDays * DAY_MS).toISOString(),
    };
    await this.store.update<WhitelabelShare[]>(COLLECTION, [], (shares) => [
      ...shares,
      share,
    ]);
    return share;
  }

  async getShare(
    id: string,
    now: number = Date.now(),
  ): Promise<WhitelabelShare | null> {
    const shares = await this.store.read<WhitelabelShare[]>(COLLECTION, []);
    const share = shares.find((s) => s.id === id);
    return share && !isShareExpired(share, now) ? share : null;
  }
}
