import { describe, expect, it } from 'vitest';
import { calculateLayoutPrices } from '../app/utils/tecsafe-pricing';

describe('calculateLayoutPrices', () => {
  it('converts net EUR scales and service prices to gross while preserving discounts and IDs', () => {
    const allowance = {
      reasonText: 'Discount',
      type: 'percentage' as const,
      value: '10',
    };
    const request = {
      requestId: 'prices-1',
      layout: {
        taxCategory: 'S',
        priceScales: [
          {
            fromQuantity: 1,
            unitPrice: '100.00',
            effectiveUnitPrice: '90.00',
            allowancesAndCharges: [allowance],
          },
          {
            fromQuantity: 10,
            unitPrice: '80.00',
            effectiveUnitPrice: '80.00',
            allowancesAndCharges: [],
          },
        ],
      },
      tecsafeServices: [
        {
          serviceId: 'service-1',
          serviceTitle: { de: 'Service' },
          serviceCategory: 'test',
          isMandatory: true,
          taxCategory: 'AA',
          unitPrice: '10.00',
          effectiveUnitPrice: '9.00',
          allowancesAndCharges: [allowance],
        },
      ],
    };
    const original = structuredClone(request);
    expect(calculateLayoutPrices(request)).toEqual({
      requestId: 'prices-1',
      success: true,
      layout: {
        taxCategory: 'S',
        priceScales: [
          {
            fromQuantity: 1,
            unitPrice: '119.00',
            effectiveUnitPrice: '107.10',
            allowancesAndCharges: [allowance],
          },
          {
            fromQuantity: 10,
            unitPrice: '95.20',
            effectiveUnitPrice: '95.20',
            allowancesAndCharges: [],
          },
        ],
      },
      tecsafeServices: [
        {
          serviceId: 'service-1',
          taxCategory: 'AA',
          unitPrice: '10.70',
          effectiveUnitPrice: '9.63',
          allowancesAndCharges: [allowance],
        },
      ],
    });
    expect(request).toEqual(original);
  });

  it('rejects an unknown tax category instead of returning untaxed prices', () => {
    expect(() =>
      calculateLayoutPrices({
        requestId: 'unknown-tax',
        layout: { taxCategory: 'UNKNOWN', priceScales: [] },
        tecsafeServices: [],
      }),
    ).toThrow('Unknown tax category');
  });

  it('rounds a half cent up when converting to gross', () => {
    const result = calculateLayoutPrices({
      requestId: 'rounding',
      layout: {
        taxCategory: 'S',
        priceScales: [
          {
            fromQuantity: 1,
            unitPrice: '1.50',
            effectiveUnitPrice: '1.50',
            allowancesAndCharges: [],
          },
        ],
      },
      tecsafeServices: [],
    });
    expect(result.layout.priceScales[0]?.unitPrice).toBe('1.79');
  });
});
