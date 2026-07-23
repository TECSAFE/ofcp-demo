import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { deleteStoredLogo, getStoredLogo, putStoredLogo } from '../app/utils/logo-store';

describe('logo store', () => {
  beforeEach(async () => {
    await deleteStoredLogo();
  });

  it('returns null when no logo is stored', async () => {
    expect(await getStoredLogo()).toBeNull();
  });

  it('round-trips a logo blob with its MIME type', async () => {
    await putStoredLogo(new Blob(['<svg></svg>'], { type: 'image/svg+xml' }));
    const stored = await getStoredLogo();
    expect(stored).toBeInstanceOf(Blob);
    expect(stored?.type).toBe('image/svg+xml');
    expect(await stored?.text()).toBe('<svg></svg>');
  });

  it('overwrites an existing logo', async () => {
    await putStoredLogo(new Blob(['old'], { type: 'image/png' }));
    await putStoredLogo(new Blob(['new'], { type: 'image/webp' }));
    const stored = await getStoredLogo();
    expect(stored?.type).toBe('image/webp');
    expect(await stored?.text()).toBe('new');
  });

  it('deletes the stored logo', async () => {
    await putStoredLogo(new Blob(['x'], { type: 'image/png' }));
    await deleteStoredLogo();
    expect(await getStoredLogo()).toBeNull();
  });
});
