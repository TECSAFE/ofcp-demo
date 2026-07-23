import { INestApplication } from '@nestjs/common';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

export async function createTestApp(
  overrides?: (builder: TestingModuleBuilder) => TestingModuleBuilder,
): Promise<INestApplication<App>> {
  process.env.DATA_DIR = await mkdtemp(join(tmpdir(), 'ofcp-demo-e2e-'));
  process.env.PORT ??= '4000';
  process.env.UI_ORIGIN ??= 'http://localhost:3000';
  process.env.OFCP_GATEWAY_URL ??= 'https://gateway.test';
  process.env.GUEST_SESSION_TTL_DAYS ??= '7';
  process.env.SESSION_TTL_DAYS ??= '30';
  process.env.USER_TTL_DAYS ??= '90';
  let builder = Test.createTestingModule({ imports: [AppModule] });
  if (overrides) builder = overrides(builder);
  const moduleFixture = await builder.compile();
  const app = moduleFixture.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();
  return app;
}
