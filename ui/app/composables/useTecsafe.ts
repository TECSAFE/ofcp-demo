import {
  IN_MESSAGES,
  OUT_MESSAGES,
  TecsafeWidgetManager,
  WidgetManagerConfig,
} from '@tecsafe/widget-sdk';
import type { BaseWidget, TecsafeArticle } from '@tecsafe/widget-sdk';

// The widget SDK exposes its message definitions through the IN_MESSAGES /
// OUT_MESSAGES maps rather than as individual named exports.
const { InMessageRequestArticleInfo } = IN_MESSAGES;
const { OutMessageArticleInfo } = OUT_MESSAGES;

// The SDK requires a single manager instance per page (duplicate instances
// double-fetch tokens and double-bind events), hence module-level state.
let manager: TecsafeWidgetManager | null = null;

/**
 * Builds the SDK configuration. Extracted so the flag mapping is testable without a manager:
 * the demo's single whitelabel debug switch turns on both SDK debug features - the debug
 * console widget and the host-page SDK debugger overlay.
 */
export function buildWidgetManagerConfig(input: {
  trackingAllowed: boolean;
  languageRFC4647: string;
  widgetBaseUrl: string;
  debug: boolean;
  tecsafeArticles: TecsafeArticle[];
}): WidgetManagerConfig {
  return new WidgetManagerConfig({
    trackingAllowed: input.trackingAllowed,
    languageRFC4647: input.languageRFC4647,
    currencyCodeISO4217: 'EUR',
    taxIncluded: true,
    widgetBaseURL: input.widgetBaseUrl,
    allowedOrigins: [new URL(input.widgetBaseUrl).origin],
    debugWidget: input.debug,
    sdkDebugger: input.debug,
    tecsafeArticles: input.tecsafeArticles,
  });
}

export function useTecsafe() {
  const config = useRuntimeConfig();
  const api = useApi();
  const { consent } = useConsent();
  const { $i18n } = useNuxtApp();
  const { settings } = useWhitelabel();

  function ensureManager(): TecsafeWidgetManager {
    if (manager) return manager;
    if (!consent.value?.dataExchange) {
      throw new Error('TecsafeWidgetManager must not be created without data-exchange consent');
    }
    manager = new TecsafeWidgetManager(
      // CustomerTokenCallback: the demo API performs the real two-step
      // exchange; oldToken makes TECSAFE merge guest assets on login.
      async (oldToken?: string) => {
        const res = await api<{ token: string }>('/tecsafe/token', {
          method: 'POST',
          body: { oldToken },
        });
        return res.token;
      },
      {
        single: async (articleNumber: string, quantity: number, configurationId?: string) => {
          try {
            await api('/cart/items', {
              method: 'POST',
              body: { articleNumber, quantity, configurationId },
            });
            return true;
          } catch (e) {
            console.error('Failed to add TECSAFE item to cart', e);
            return false;
          }
        },
      },
      buildWidgetManagerConfig({
        trackingAllowed: consent.value.tracking,
        languageRFC4647:
          $i18n.locales.value.find((l) => l.code === $i18n.locale.value)?.language ??
          $i18n.locale.value,
        widgetBaseUrl: config.public.widgetBaseUrl,
        debug: settings.value.debugWidget,
      }),
    );
    manager.on(InMessageRequestArticleInfo, async (e) => {
      try {
        const { product } = await api<{ product: Product }>(`/products/${e.event.articleNumber}`);
        e.respond(
          OutMessageArticleInfo.create({
            articleNumber: e.event.articleNumber,
            info: {
              ean: product.ean,
              name: product.name,
              price: product.price.toFixed(2),
              stock: product.stock,
              description: product.description,
            },
          }),
        );
      } catch {
        // Always answer, even for unknown articles, so the widget can
        // render its fallback instead of timing out.
        e.respond(
          OutMessageArticleInfo.create({ articleNumber: e.event.articleNumber, info: null }),
        );
      }
    });
    return manager;
  }

  function createDebugWidget(el: HTMLElement): BaseWidget {
    // The SDK's factory registers and shows the widget itself, and only works when
    // config.debugWidget is on - which ensureManager() derives from the whitelabel switch.
    return ensureManager().createDebugWidget(el);
  }

  async function destroy(): Promise<void> {
    if (!manager) return;
    const current = manager;
    manager = null;
    await current.destroyAll();
  }

  async function refreshToken(): Promise<void> {
    // No-op without a manager: the next ensureManager() fetches a fresh
    // token anyway, passing the SDK's persisted oldToken along.
    await manager?.refreshToken();
  }

  return { ensureManager, createDebugWidget, destroy, refreshToken };
}
