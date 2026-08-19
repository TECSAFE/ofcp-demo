import { describe, expect, it } from 'vitest';
import { buildWidgetManagerConfig } from '../app/composables/useTecsafe';

const base = {
  trackingAllowed: false,
  languageRFC4647: 'de-DE',
  widgetBaseUrl: 'https://app-ui.example.com/iframe',
};

describe('buildWidgetManagerConfig', () => {
  it('leaves both SDK debug features off by default', () => {
    const config = buildWidgetManagerConfig({ ...base, debug: false });
    expect(config.debugWidget).toBe(false);
    expect(config.sdkDebugger).toBe(false);
  });

  it('turns on both SDK debug features from the single demo debug switch', () => {
    const config = buildWidgetManagerConfig({ ...base, debug: true });
    expect(config.debugWidget).toBe(true);
    expect(config.sdkDebugger).toBe(true);
  });

  it('allows exactly the widget base URL origin', () => {
    const config = buildWidgetManagerConfig({ ...base, debug: false });
    expect(config.allowedOrigins).toEqual(['https://app-ui.example.com']);
    expect(config.widgetBaseURL).toBe('https://app-ui.example.com/iframe');
  });

  it('passes tracking and language through unchanged', () => {
    const config = buildWidgetManagerConfig({
      ...base,
      trackingAllowed: true,
      languageRFC4647: 'en-US',
      debug: false,
    });
    expect(config.trackingAllowed).toBe(true);
    expect(config.languageRFC4647).toBe('en-US');
    expect(config.currencyCodeISO4217).toBe('EUR');
    expect(config.taxIncluded).toBe(true);
  });
});
