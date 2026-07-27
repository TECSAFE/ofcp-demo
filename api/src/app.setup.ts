import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { json } from 'express';

/** Shared between main.ts and e2e tests so both run the identical pipeline. */
export function configureApp(app: INestApplication): void {
  // Registered before Nest's built-in body parser, which skips bodies that are
  // already parsed — a base64 logo (up to ~2.8 MB) exceeds express's 100 kB default.
  app.use(json({ limit: '4mb' }));
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
}
