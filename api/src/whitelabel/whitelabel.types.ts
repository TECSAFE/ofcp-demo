export type WhitelabelShareSettings = {
  shopName: string;
  primaryColor: string;
  surfaceColor: string;
  debugWidget: boolean;
  sdkDebugger?: boolean;
};

/** Raw base64 (no `data:` prefix) plus the image MIME type. */
export type WhitelabelShareLogo = {
  type: string;
  base64: string;
};

export type WhitelabelShare = {
  id: string;
  settings: WhitelabelShareSettings;
  logo: WhitelabelShareLogo | null;
  createdAt: string;
  expiresAt: string;
};
