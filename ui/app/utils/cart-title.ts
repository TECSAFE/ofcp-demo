import type { CartView } from './types';

export function cartItemName(item: CartView['items'][number], language: string): string {
  const description = item.punchout?.position.description;
  if (!description) return item.name;

  const requested = language.toLowerCase();
  const base = requested.split('-')[0];
  const maps = [description.customerTitle, description.title];
  for (const texts of maps) {
    const entries = Object.entries(texts ?? {}).filter(
      ([, text]) => typeof text === 'string' && text.trim(),
    );
    const match =
      entries.find(([tag]) => tag.toLowerCase() === requested) ??
      entries.find(([tag]) => tag.toLowerCase() === base) ??
      entries.find(([tag]) => tag.toLowerCase().split('-')[0] === base);
    if (match) return match[1];
  }
  return (
    maps
      .flatMap((texts) => Object.values(texts ?? {}))
      .find((text) => typeof text === 'string' && text.trim()) ?? item.name
  );
}
