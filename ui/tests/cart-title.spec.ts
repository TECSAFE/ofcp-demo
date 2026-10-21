import { describe, expect, it } from 'vitest';
import { computed, ref } from 'vue';
import type { CartPunchoutPosition } from '@tecsafe/widget-sdk';
import { cartItemName } from '../app/utils/cart-title';
import type { CartView } from '../app/utils/types';

const item = {
  articleNumber: 'LAYOUT',
  quantity: 1,
  name: 'Mein Layout',
  unitPrice: 10,
  lineTotal: 10,
  punchout: {
    transferId: 'transfer-1',
    tecsafeTotal: 10,
    position: {
      positionId: 'layout-1',
      parentPositionId: null,
      type: 'layout',
      identifiers: {},
      description: {
        title: { 'de-DE': 'Mein Layout', 'en-US': 'My layout' },
      } as CartPunchoutPosition['description'],
      quantity: { relation: 'independent', value: '1', total: '1', unitOfMeasure: 'PCE' },
      pricing: {
        unitPrice: '10',
        effectiveUnitPrice: '10',
        lineAmount: '10',
        allowancesAndCharges: [],
      },
      taxCategory: 'S',
    },
  },
} satisfies CartView['items'][number];

describe('cart title language', () => {
  it('changes punchout titles with the shop language without refetching the cart', () => {
    const language = ref('en-US');
    const title = computed(() => cartItemName(item, language.value));
    expect(title.value).toBe('My layout');
    language.value = 'de-DE';
    expect(title.value).toBe('Mein Layout');
  });

  it('prefers the customer title in the requested language', () => {
    const custom = structuredClone(item);
    custom.punchout.position.description = {
      title: item.punchout.position.description.title,
      customerTitle: { 'de-DE': 'Meine Werkzeuge', 'en-US': 'My tools' },
    };
    expect(cartItemName(custom, 'en-US')).toBe('My tools');
  });

  it('uses a translated standard title before a customer title in an unrelated language', () => {
    const custom = structuredClone(item);
    custom.punchout.position.description = {
      title: item.punchout.position.description.title,
      customerTitle: { de: 'Meine Werkzeuge' },
    };
    expect(cartItemName(custom, 'en')).toBe('My layout');
  });

  it('matches base languages and regional variants case-insensitively', () => {
    const custom = structuredClone(item);
    custom.punchout.position.description = { title: { en: 'English layout', 'de-DE': 'Layout' } };
    expect(cartItemName(custom, 'en-GB')).toBe('English layout');
    expect(cartItemName(item, 'EN-gb')).toBe('My layout');
  });

  it('falls back to supplied titles and preserves names for ordinary shop items', () => {
    expect(cartItemName(item, 'fr')).toBe('Mein Layout');
    expect(cartItemName({ ...item, punchout: undefined, name: 'Shop product' }, 'en')).toBe(
      'Shop product',
    );
    const empty = structuredClone(item);
    empty.punchout.position.description = { title: {} };
    expect(cartItemName(empty, 'en')).toBe('Mein Layout');
  });
});
