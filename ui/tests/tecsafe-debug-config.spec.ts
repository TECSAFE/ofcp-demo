import { describe, expect, it, vi } from 'vitest';
import { buildWidgetManagerConfig, loadTecsafeArticles } from '../app/composables/useTecsafe';

const base = {
  trackingAllowed: false,
  language: 'de-DE',
  widgetBaseUrl: 'https://app-ui.example.com/iframe',
  tecsafeArticles: [{ productNumber: 'OFCP-DUMMY-001', price: '1.00' }],
};

describe('buildWidgetManagerConfig', () => {
  it('leaves both SDK debug features off by default', () => {
    const config = buildWidgetManagerConfig({
      ...base,
      debugWidget: false,
      sdkDebugger: false,
    });
    expect(config.debugWidget).toBe(false);
    expect(config.sdkDebugger).toBe(false);
  });

  it.each([
    [true, false],
    [false, true],
    [true, true],
  ])('keeps widget=%s and SDK=%s debug modes independent', (debugWidget, sdkDebugger) => {
    const config = buildWidgetManagerConfig({
      ...base,
      debugWidget,
      sdkDebugger,
    });
    expect(config.debugWidget).toBe(debugWidget);
    expect(config.sdkDebugger).toBe(sdkDebugger);
  });

  it('allows exactly the widget base URL origin', () => {
    const config = buildWidgetManagerConfig({
      ...base,
      debugWidget: false,
      sdkDebugger: false,
    });
    expect(config.allowedOrigins).toEqual(['https://app-ui.example.com']);
    expect(config.widgetBaseURL).toBe('https://app-ui.example.com/iframe');
  });

  it('passes tracking and language through unchanged', () => {
    const config = buildWidgetManagerConfig({
      ...base,
      trackingAllowed: true,
      language: 'en-US',
      debugWidget: false,
      sdkDebugger: false,
    });
    expect(config.trackingAllowed).toBe(true);
    expect(config.language).toBe('en-US');
    expect(config.currencyCode).toBe('EUR');
    expect(config.priceMode).toBe('gross');
    expect(config.taxCategories).toEqual({ S: 19, AA: 7 });
  });

  it('passes the shop TECSAFE article list through to the SDK config', () => {
    const articles = [{ productNumber: 'OFCP-DUMMY-007', price: '7.00' }];
    const config = buildWidgetManagerConfig({
      ...base,
      debugWidget: false,
      sdkDebugger: false,
      tecsafeArticles: articles,
    });
    expect(config.tecsafeArticles).toEqual(articles);
  });
});

describe('loadTecsafeArticles', () => {
  it('replaces the target array contents in place with the fetched articles', async () => {
    const target = [{ productNumber: 'STALE', price: '0.00' }];
    const api = vi.fn().mockResolvedValue({
      articles: [{ productNumber: 'OFCP-DUMMY-001', price: '1.00' }],
    });

    await loadTecsafeArticles(api, target);

    expect(target).toEqual([{ productNumber: 'OFCP-DUMMY-001', price: '1.00' }]);
    expect(api).toHaveBeenCalledWith('/products/tecsafe-articles');
  });

  it('keeps the same array reference so live readers see the update', async () => {
    const target = [{ productNumber: 'STALE', price: '0.00' }];
    const reference = target;
    const api = vi.fn().mockResolvedValue({ articles: [] });

    await loadTecsafeArticles(api, target);

    expect(target).toBe(reference);
  });

  it('swallows fetch failures and leaves the target unchanged', async () => {
    const target = [{ productNumber: 'KEEP', price: '2.00' }];
    const api = vi.fn().mockRejectedValue(new Error('network down'));

    await expect(loadTecsafeArticles(api, target)).resolves.toBeUndefined();

    expect(target).toEqual([{ productNumber: 'KEEP', price: '2.00' }]);
  });
});
