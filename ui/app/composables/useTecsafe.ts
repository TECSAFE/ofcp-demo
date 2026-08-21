import {
  IN_MESSAGES,
  OUT_MESSAGES,
  TecsafeWidgetManager,
  WidgetManagerConfig,
} from '@tecsafe/widget-sdk';
import type { ArticleIdentifier, BaseWidget, TecsafeArticle } from '@tecsafe/widget-sdk';

// The widget SDK exposes its message definitions through the IN_MESSAGES /
// OUT_MESSAGES maps rather than as individual named exports.
const { InMessageRequestArticleInfo } = IN_MESSAGES;
const { OutMessageArticleInfo } = OUT_MESSAGES;

// The SDK requires a single manager instance per page (duplicate instances
// double-fetch tokens and double-bind events), hence module-level state.
let manager: TecsafeWidgetManager | null = null;

// ensureManager() must stay synchronous, but the shop's TECSAFE article list
// comes from the API. The SDK reads config.tecsafeArticles live at request
// time, so this stable array reference is handed to the config once and its
// *contents* are swapped in place (loadTecsafeArticles) once the fetch
// resolves, rather than replacing the array itself.
const tecsafeArticles: TecsafeArticle[] = [];

/**
 * Fetches the shop's TECSAFE article list and replaces `target`'s contents in place.
 * Exported for testing; production callers rely on the `target` default.
 */
export async function loadTecsafeArticles(
  api: (url: string) => Promise<{ articles: TecsafeArticle[] }>,
  target: TecsafeArticle[] = tecsafeArticles,
): Promise<void> {
  try {
    const { articles } = await api('/products/tecsafe-articles');
    target.splice(0, target.length, ...articles);
  } catch (e) {
    // Swallow and keep whatever list we already had - the demo must not
    // crash if the API is briefly unavailable, and we don't retry in a loop.
    console.error('Failed to load the TECSAFE article list', e);
  }
}

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

/** The demo's own article number, if the identifier carries one; otherwise its EAN. */
function fallbackArticleNumber(identifier: ArticleIdentifier): string {
  return (
    ('manufacturerArticleNumber' in identifier && identifier.manufacturerArticleNumber) ||
    ('ean' in identifier && identifier.ean) ||
    ''
  );
}

// The exact payload shape OutMessageArticleInfo.create() expects, derived from the SDK
// rather than duplicated by hand so it can't drift from the message definition.
type ArticleInfoPayload = Parameters<typeof OutMessageArticleInfo.create>[0];

/**
 * Answers a `request-article-info` message once per requested identifier, echoing the
 * identifier back so the widget can correlate it. Extracted so it is testable without a
 * Nuxt app or a manager instance - `fetchProduct` and `respond` are the only SDK/API touch
 * points. One identifier's lookup failing must not prevent the others from being answered.
 */
export async function respondToArticleInfoRequest(
  identifiers: ArticleIdentifier[],
  fetchProduct: (identifier: ArticleIdentifier) => Promise<Product | null>,
  respond: (payload: ArticleInfoPayload) => void,
): Promise<void> {
  await Promise.all(
    identifiers.map(async (identifier) => {
      try {
        const product = await fetchProduct(identifier);
        respond({
          article: identifier,
          articleNumber: product?.articleNumber ?? fallbackArticleNumber(identifier),
          info: product
            ? {
                ean: product.ean,
                name: product.name,
                price: product.price.toFixed(2),
                stock: product.stock,
                description: product.description,
              }
            : null,
        });
      } catch {
        // Always answer, even for unknown/unresolvable articles, so the
        // widget can render its fallback instead of timing out.
        respond({
          article: identifier,
          articleNumber: fallbackArticleNumber(identifier),
          info: null,
        });
      }
    }),
  );
}

/**
 * Resolves an identifier to a product: manufacturerArticleNumber maps directly to the
 * demo's articleNumber lookup, otherwise it is resolved by EAN. Never fetches the full
 * catalog - each identifier is looked up individually.
 */
async function fetchProductByIdentifier(
  api: ReturnType<typeof useApi>,
  identifier: ArticleIdentifier,
): Promise<Product | null> {
  if ('manufacturerArticleNumber' in identifier && identifier.manufacturerArticleNumber) {
    const { product } = await api<{ product: Product }>(
      `/products/${identifier.manufacturerArticleNumber}`,
    );
    return product;
  }
  if ('ean' in identifier && identifier.ean) {
    const { product } = await api<{ product: Product }>(`/products/ean/${identifier.ean}`);
    return product;
  }
  return null;
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
    // Fire-and-forget: the config below hands the SDK the stable array
    // reference immediately so ensureManager() stays synchronous.
    void loadTecsafeArticles(api);
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
        tecsafeArticles,
      }),
    );
    manager.on(InMessageRequestArticleInfo, (e) =>
      respondToArticleInfoRequest(
        e.event.articles,
        (identifier) => fetchProductByIdentifier(api, identifier),
        (payload) => e.respond(OutMessageArticleInfo.create(payload)),
      ),
    );
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
