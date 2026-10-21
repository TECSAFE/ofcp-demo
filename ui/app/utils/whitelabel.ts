export type WhitelabelSettings = {
  shopName: string;
  primaryColor: string;
  surfaceColor: string;
  debugWidget: boolean;
  sdkDebugger: boolean;
  updatedAt: string;
};

export const WHITELABEL_STORAGE_KEY = 'demo-shop-whitelabel';

export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export const DEFAULT_WHITELABEL: WhitelabelSettings = {
  shopName: 'Demo Shop',
  primaryColor: '#0f172a', // Tailwind slate-900, the shipped button color
  surfaceColor: '#cbd5e1', // Tailwind slate-300, the shipped header/footer color
  debugWidget: false,
  sdkDebugger: false,
  updatedAt: new Date(0).toISOString(),
};

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

export type LogoValidationError = 'notImage' | 'tooLarge';

export function validateLogoFile(file: Pick<File, 'type' | 'size'>): LogoValidationError | null {
  if (!file.type.startsWith('image/')) return 'notImage';
  if (file.size > MAX_LOGO_BYTES) return 'tooLarge';
  return null;
}

export function parseStoredWhitelabel(raw: string | null): WhitelabelSettings | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const value = parsed as Partial<Record<keyof WhitelabelSettings, unknown>>;

  const shopName =
    typeof value.shopName === 'string' && value.shopName.trim() !== ''
      ? value.shopName.trim()
      : DEFAULT_WHITELABEL.shopName;
  return {
    shopName,
    primaryColor: isHexColor(value.primaryColor)
      ? value.primaryColor
      : DEFAULT_WHITELABEL.primaryColor,
    surfaceColor: isHexColor(value.surfaceColor)
      ? value.surfaceColor
      : DEFAULT_WHITELABEL.surfaceColor,
    debugWidget:
      typeof value.debugWidget === 'boolean' ? value.debugWidget : DEFAULT_WHITELABEL.debugWidget,
    // The old debug switch enabled both features; preserve that for saved demos.
    sdkDebugger:
      typeof value.sdkDebugger === 'boolean' ? value.sdkDebugger : value.debugWidget === true,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date(0).toISOString(),
  };
}
