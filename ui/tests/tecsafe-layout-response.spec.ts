import { describe, expect, it, vi } from 'vitest';
import type { LayoutPricesRequest } from '@tecsafe/widget-sdk';
import { respondToLayoutPricesRequest } from '../app/composables/useTecsafe';

function request(): LayoutPricesRequest {
  return {
    requestId: 'layout-request-1',
    layout: {
      taxCategory: 'S',
      priceScales: [
        {
          fromQuantity: 1,
          unitPrice: '10.00',
          effectiveUnitPrice: '10.00',
          allowancesAndCharges: [],
        },
      ],
    },
    tecsafeServices: [
      {
        serviceId: 'service-1',
        serviceTitle: { en: 'Service' },
        serviceCategory: 'test',
        isMandatory: true,
        taxCategory: 'AA',
        unitPrice: '10.00',
        effectiveUnitPrice: '10.00',
        allowancesAndCharges: [],
      },
    ],
  };
}

describe('layout price responses', () => {
  it('replies once with gross prices and the original request and service IDs', () => {
    const respond = vi.fn();
    const input = request();
    const original = structuredClone(input);
    respondToLayoutPricesRequest(input, respond);
    expect(respond).toHaveBeenCalledExactlyOnceWith({
      requestId: 'layout-request-1',
      success: true,
      layout: {
        taxCategory: 'S',
        priceScales: [
          {
            fromQuantity: 1,
            unitPrice: '11.90',
            effectiveUnitPrice: '11.90',
            allowancesAndCharges: [],
          },
        ],
      },
      tecsafeServices: [
        {
          serviceId: 'service-1',
          taxCategory: 'AA',
          unitPrice: '10.70',
          effectiveUnitPrice: '10.70',
          allowancesAndCharges: [],
        },
      ],
    });
    expect(input).toEqual(original);
  });

  it.each(['layout tax', 'layout price', 'service tax', 'service price'])(
    'replies once with a correlated failure and no prices for invalid %s',
    (invalid) => {
      const input = request();
      if (invalid === 'layout tax') input.layout.taxCategory = 'UNKNOWN';
      if (invalid === 'layout price') input.layout.priceScales[0]!.unitPrice = '1,50';
      if (invalid === 'service tax') input.tecsafeServices[0]!.taxCategory = 'UNKNOWN';
      if (invalid === 'service price') input.tecsafeServices[0]!.effectiveUnitPrice = '1,50';
      const respond = vi.fn();
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        expect(() => respondToLayoutPricesRequest(input, respond)).not.toThrow();
        expect(respond).toHaveBeenCalledExactlyOnceWith({
          requestId: 'layout-request-1',
          success: false,
          error: 'Unable to calculate layout prices',
        });
      } finally {
        log.mockRestore();
      }
    },
  );

  it('does not send a second reply when sending the response itself throws', () => {
    const respond = vi.fn(() => {
      throw new Error('Transport unavailable');
    });
    expect(() => respondToLayoutPricesRequest(request(), respond)).toThrow('Transport unavailable');
    expect(respond).toHaveBeenCalledTimes(1);
  });
});
