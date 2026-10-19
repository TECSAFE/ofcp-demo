import {
  IN_MESSAGES,
  OUT_MESSAGES,
  TecsafeWidgetManager,
  WidgetManagerConfig,
} from '@tecsafe/widget-sdk';
import type {
  ArticleIdentifier,
  BaseWidget,
  CartPunchoutRequest,
  CartPunchoutResult,
} from '@tecsafe/widget-sdk';
import { calculateLayoutPrices, DEMO_TAX_CATEGORIES } from '../utils/tecsafe-pricing';

// The widget SDK exposes its message definitions through the IN_MESSAGES /
// OUT_MESSAGES maps rather than as individual named exports.
const { InMessageRequestArticleInfo, InMessageRequestLayoutPrices, InMessageCartPunchout } =
  IN_MESSAGES;
const { OutMessageArticleInfo, OutMessageLayoutPrices, OutMessageCartPunchoutResult } =
  OUT_MESSAGES;

// TecsafeArticle is not a root export, so it is derived
// from the config field it populates instead of deep-importing SDK internals.
type TecsafeArticle = WidgetManagerConfig['tecsafeArticles'][number];

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
  language: string;
  widgetBaseUrl: string;
  debug: boolean;
  tecsafeArticles: TecsafeArticle[];
}): WidgetManagerConfig {
  return new WidgetManagerConfig({
    trackingAllowed: input.trackingAllowed,
    language: input.language,
    currencyCode: 'EUR',
    priceMode: 'gross',
    taxCategories: { ...DEMO_TAX_CATEGORIES },
    widgetBaseURL: input.widgetBaseUrl,
    allowedOrigins: [new URL(input.widgetBaseUrl).origin],
    debugWidget: input.debug,
    sdkDebugger: input.debug,
    tecsafeArticles: input.tecsafeArticles,
  });
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
          info: product
            ? {
                hostShopArticleNumber: product.articleNumber,
                availableStock: product.stock > 0,
                taxCategory: 'S',
                priceScales: [
                  {
                    fromQuantity: 1,
                    unitPrice: product.price.toFixed(2),
                    allowancesAndCharges: [],
                    effectiveUnitPrice: product.price.toFixed(2),
                  },
                ],
              }
            : null,
        });
      } catch {
        // Always answer, even for unknown/unresolvable articles, so the
        // widget can render its fallback instead of timing out.
        respond({
          article: identifier,
          info: null,
        });
      }
    }),
  );
}

/**
 * Resolves an identifier to a product: manufacturerArticleNumber maps directly to the
 * demo's articleNumber lookup, as does supplierArticleNumber. GTIN uses the EAN endpoint.
 * Never fetches the full catalog - each identifier is looked up individually.
 */
export async function fetchProductByIdentifier(
  api: ReturnType<typeof useApi>,
  identifier: ArticleIdentifier,
): Promise<Product | null> {
  if ('manufacturerArticleNumber' in identifier && identifier.manufacturerArticleNumber) {
    const { product } = await api<{ product: Product }>(
      `/products/${encodeURIComponent(identifier.manufacturerArticleNumber)}`,
    );
    return product;
  }
  if (identifier.supplierArticleNumber) {
    const { product } = await api<{ product: Product }>(
      `/products/${encodeURIComponent(identifier.supplierArticleNumber)}`,
    );
    return product;
  }
  if (identifier.gtin) {
    const { product } = await api<{ product: Product }>(
      `/products/ean/${encodeURIComponent(identifier.gtin)}`,
    );
    return product;
  }
  return null;
}

/** Reply once, after the backend has accepted or rejected the complete transfer. */
export async function respondToCartPunchoutRequest(
  request: CartPunchoutRequest,
  transfer: (request: CartPunchoutRequest) => Promise<boolean>,
  respond: (result: CartPunchoutResult) => void,
): Promise<void> {
  let success = false;
  try {
    success = await transfer(request);
  } catch (error) {
    console.error('Failed to transfer TECSAFE positions to cart', error);
  }
  respond({ success });
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
      buildWidgetManagerConfig({
        trackingAllowed: consent.value.tracking,
        language:
          $i18n.locales.value.find((l) => l.code === $i18n.locale.value)?.language ??
          $i18n.locale.value,
        widgetBaseUrl: config.public.widgetBaseUrl,
        debug: settings.value.debugWidget,
        tecsafeArticles,
      }),
    );
    // Register synchronously: the SDK can restore a fullscreen widget in a microtask.
    manager.on(InMessageRequestArticleInfo, (e) =>
      respondToArticleInfoRequest(
        e.event.articles,
        (identifier) => fetchProductByIdentifier(api, identifier),
        (payload) => e.respond(OutMessageArticleInfo.create(payload)),
      ),
    );
    manager.on(InMessageRequestLayoutPrices, (e) => {
      e.respond(OutMessageLayoutPrices.create(calculateLayoutPrices(e.event)));
    });
    manager.on(InMessageCartPunchout, (e) =>
      respondToCartPunchoutRequest(
        e.event,
        async (request) => {
          const result = await api<CartPunchoutResult>('/cart/punchout', {
            method: 'POST',
            body: request,
          });
          return result.success;
        },
        (result) => e.respond(OutMessageCartPunchoutResult.create(result)),
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
