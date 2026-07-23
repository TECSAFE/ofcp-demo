import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { FileStoreService } from '../file-store/file-store.service';
import { Session } from './session.types';

@Injectable()
export class SessionService {
  constructor(private readonly store: FileStoreService) {}

  async getOrCreate(sid?: string): Promise<Session> {
    if (sid) {
      const sessions = await this.store.read<Session[]>('sessions', []);
      const existing = sessions.find((s) => s.sid === sid);
      if (existing) return existing;
    }
    const now = new Date().toISOString();
    const session: Session = {
      sid: randomUUID(),
      userId: null,
      createdAt: now,
      lastSeenAt: now,
    };
    await this.store.update<Session[]>('sessions', [], (sessions) => [
      ...sessions,
      session,
    ]);
    return session;
  }

  async setUser(sid: string, userId: string | null): Promise<void> {
    await this.store.update<Session[]>('sessions', [], (sessions) =>
      sessions.map((s) => (s.sid === sid ? { ...s, userId } : s)),
    );
  }

  async touch(
    sid: string,
    at: string = new Date().toISOString(),
  ): Promise<void> {
    await this.store.update<Session[]>('sessions', [], (sessions) =>
      sessions.map((s) => (s.sid === sid ? { ...s, lastSeenAt: at } : s)),
    );
  }
}
