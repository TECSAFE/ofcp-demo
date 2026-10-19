import type { LayoutPricesRequest, LayoutPricesResponse, UnitPricing } from '@tecsafe/widget-sdk';

export const DEMO_TAX_CATEGORIES = { S: 19, AA: 7 };

/** The demo sells in gross EUR; the SDK always supplies layout prices in net EUR. */
export function calculateLayoutPrices(request: LayoutPricesRequest): LayoutPricesResponse {
  function grossPricing(pricing: UnitPricing, taxCategory: string): UnitPricing {
    const rate = DEMO_TAX_CATEGORIES[taxCategory as keyof typeof DEMO_TAX_CATEGORIES];
    if (!Object.hasOwn(DEMO_TAX_CATEGORIES, taxCategory))
      throw new Error(`Unknown tax category: ${taxCategory}`);
    const gross = (price: string) => {
      if (!/^\d+(?:\.\d+)?$/.test(price)) throw new Error(`Invalid net price: ${price}`);
      const [whole, fraction = ''] = price.split('.');
      const scale = 10n ** BigInt(fraction.length);
      // Work in decimal integers so e.g. 1.50 * 1.19 rounds from 1.785 to 1.79.
      const cents = (BigInt(`${whole}${fraction}`) * BigInt(100 + rate) + scale / 2n) / scale;
      return `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`;
    };
    return {
      unitPrice: gross(pricing.unitPrice),
      effectiveUnitPrice: gross(pricing.effectiveUnitPrice),
      allowancesAndCharges: pricing.allowancesAndCharges,
    };
  }

  // Validate even when no quantity scales were supplied.
  if (!Object.hasOwn(DEMO_TAX_CATEGORIES, request.layout.taxCategory)) {
    throw new Error(`Unknown tax category: ${request.layout.taxCategory}`);
  }
  return {
    requestId: request.requestId,
    layout: {
      taxCategory: request.layout.taxCategory,
      priceScales: request.layout.priceScales.map((scale) => ({
        fromQuantity: scale.fromQuantity,
        ...grossPricing(scale, request.layout.taxCategory),
      })),
    },
    tecsafeServices: request.tecsafeServices.map((service) => ({
      serviceId: service.serviceId,
      taxCategory: service.taxCategory,
      ...grossPricing(service, service.taxCategory),
    })),
  };
}
