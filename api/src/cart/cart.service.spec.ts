import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStoreService } from '../file-store/file-store.service';
import { ConfigService } from '../shared/config/config.service';
import { ProductsService } from '../products/products.service';
import { CartService } from './cart.service';

describe('CartService', () => {
  let dir: string;
  let service: CartService;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'carts-'));
    process.env.DATA_DIR = dir;
    service = new CartService(
      new FileStoreService(new ConfigService()),
      new ProductsService(new ConfigService()),
    );
  });

  afterEach(async () => {
    delete process.env.DATA_DIR;
    await rm(dir, { recursive: true, force: true });
  });

  it('adds items and enriches them with product data', async () => {
    await service.addItem('sid-1', { articleNumber: '5054598', quantity: 2 });
    const cart = await service.getCart('sid-1');
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].name).toBeTruthy();
    expect(cart.items[0].lineTotal).toBeCloseTo(cart.items[0].unitPrice * 2);
    expect(cart.total).toBeCloseTo(cart.items[0].lineTotal);
  });

  it('merges lines with the same article and configuration', async () => {
    await service.addItem('sid-1', {
      articleNumber: '5054598',
      quantity: 1,
      configurationId: 'cfg-a',
    });
    await service.addItem('sid-1', {
      articleNumber: '5054598',
      quantity: 2,
      configurationId: 'cfg-a',
    });
    await service.addItem('sid-1', {
      articleNumber: '5054598',
      quantity: 1,
      configurationId: 'cfg-b',
    });
    const cart = await service.getCart('sid-1');
    expect(cart.items).toHaveLength(2);
    expect(
      cart.items.find((i) => i.configurationId === 'cfg-a')?.quantity,
    ).toBe(3);
  });

  it('keeps carts separate per session and clears them', async () => {
    await service.addItem('sid-1', { articleNumber: '5054598', quantity: 1 });
    await service.addItem('sid-2', { articleNumber: 'TEST-123', quantity: 1 });
    await service.clear('sid-1');
    expect((await service.getCart('sid-1')).items).toHaveLength(0);
    expect((await service.getCart('sid-2')).items).toHaveLength(1);
  });
});
