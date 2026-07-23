import { Product } from './product.types';

export const DEMO_PRODUCTS: Product[] = [
  {
    articleNumber: '5054598',
    ean: '4014549505458',
    name: 'Werkzeugkoffer Pro L',
    price: 189.99,
    stock: 12,
    description:
      'Robust tool case with a customizable interior. Use the TECSAFE configurator to design a perfectly fitting foam inlay for your tools.',
  },
  {
    articleNumber: 'TEST-123',
    ean: '4014549000123',
    name: 'Systainer Classic M',
    price: 89.5,
    stock: 5,
    description:
      'Stackable storage case for workshop and field service. Supports made-to-measure foam inlays via the TECSAFE configurator.',
  },
  {
    articleNumber: 'CASE-042',
    ean: '4014549000424',
    name: 'Transport Case 42',
    price: 249.0,
    stock: 0,
    description:
      'Heavy-duty transport case for sensitive equipment. Currently out of stock.',
  },
];
