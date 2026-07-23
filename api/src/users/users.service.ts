import { ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { FileStoreService } from '../file-store/file-store.service';
import { hashPassword, verifyPassword } from './password.util';
import { ConsentSettings, PublicUser, User } from './user.types';

@Injectable()
export class UsersService {
  constructor(private readonly store: FileStoreService) {}

  private toPublic(user: User): PublicUser {
    return { id: user.id, email: user.email };
  }

  async register(
    email: string,
    password: string,
    consent: ConsentSettings | null,
  ): Promise<PublicUser> {
    const normalized = email.trim().toLowerCase();
    const user: User = {
      id: randomUUID(),
      email: normalized,
      passwordHash: hashPassword(password),
      consent,
      createdAt: new Date().toISOString(),
    };
    await this.store.update<User[]>('users', [], (users) => {
      if (users.some((u) => u.email === normalized)) {
        throw new ConflictException('Email is already registered');
      }
      return [...users, user];
    });
    return this.toPublic(user);
  }

  async verify(email: string, password: string): Promise<PublicUser | null> {
    const normalized = email.trim().toLowerCase();
    const users = await this.store.read<User[]>('users', []);
    const user = users.find((u) => u.email === normalized);
    if (!user || !verifyPassword(password, user.passwordHash)) return null;
    return this.toPublic(user);
  }

  async getById(id: string): Promise<User | null> {
    const users = await this.store.read<User[]>('users', []);
    return users.find((u) => u.id === id) ?? null;
  }

  async setConsent(userId: string, consent: ConsentSettings): Promise<void> {
    await this.store.update<User[]>('users', [], (users) =>
      users.map((u) => (u.id === userId ? { ...u, consent } : u)),
    );
  }
}
