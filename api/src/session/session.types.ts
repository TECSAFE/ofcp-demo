import type { Request } from 'express';

export type Session = {
  sid: string;
  userId: string | null;
  createdAt: string;
  lastSeenAt: string;
};

export type RequestWithSession = Request & { shopSession: Session };
