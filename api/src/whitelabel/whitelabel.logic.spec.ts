import {
  MAX_LOGO_BYTES,
  decodedBase64Bytes,
  isShareExpired,
  secretMatches,
  validateShareLogo,
} from './whitelabel.logic';

describe('secretMatches', () => {
  it('accepts the exact secret', () => {
    expect(secretMatches('hunter2', 'hunter2')).toBe(true);
  });

  it('rejects a wrong secret, including different lengths', () => {
    expect(secretMatches('hunter3', 'hunter2')).toBe(false);
    expect(secretMatches('hunter', 'hunter2')).toBe(false);
    expect(secretMatches('', 'hunter2')).toBe(false);
  });
});

describe('decodedBase64Bytes', () => {
  it('computes the decoded size from length and padding', () => {
    expect(decodedBase64Bytes(Buffer.from('a').toString('base64'))).toBe(1); // 'YQ=='
    expect(decodedBase64Bytes(Buffer.from('ab').toString('base64'))).toBe(2); // 'YWI='
    expect(decodedBase64Bytes(Buffer.from('abc').toString('base64'))).toBe(3); // 'YWJj'
    expect(decodedBase64Bytes('')).toBe(0);
  });
});

describe('validateShareLogo', () => {
  const png = Buffer.from('fake-png-bytes').toString('base64');

  it('accepts an image within the cap', () => {
    expect(validateShareLogo({ type: 'image/png', base64: png })).toBeNull();
    expect(
      validateShareLogo({ type: 'image/svg+xml', base64: png }),
    ).toBeNull();
  });

  it('rejects non-image MIME types', () => {
    expect(validateShareLogo({ type: 'application/pdf', base64: png })).toBe(
      'notImage',
    );
    expect(validateShareLogo({ type: '', base64: png })).toBe('notImage');
  });

  it('rejects strings that are not base64', () => {
    expect(
      validateShareLogo({ type: 'image/png', base64: 'not base64!!!' }),
    ).toBe('notBase64');
    expect(validateShareLogo({ type: 'image/png', base64: 'YQ' })).toBe(
      'notBase64',
    ); // length % 4 !== 0
  });

  it('rejects logos over the 2 MB cap', () => {
    // 699051 groups of 4 chars, no padding -> 2097153 decoded bytes (cap + 1).
    const oversized = 'A'.repeat(699051 * 4);
    expect(decodedBase64Bytes(oversized)).toBe(MAX_LOGO_BYTES + 1);
    expect(validateShareLogo({ type: 'image/png', base64: oversized })).toBe(
      'tooLarge',
    );
  });
});

describe('isShareExpired', () => {
  const NOW = Date.parse('2026-07-21T00:00:00.000Z');

  it('is not expired before expiresAt', () => {
    expect(isShareExpired({ expiresAt: '2026-07-22T00:00:00.000Z' }, NOW)).toBe(
      false,
    );
  });

  it('is expired at and after expiresAt', () => {
    expect(isShareExpired({ expiresAt: '2026-07-21T00:00:00.000Z' }, NOW)).toBe(
      true,
    );
    expect(isShareExpired({ expiresAt: '2026-07-20T00:00:00.000Z' }, NOW)).toBe(
      true,
    );
  });

  it('treats an unparseable expiresAt as expired', () => {
    expect(isShareExpired({ expiresAt: 'garbage' }, NOW)).toBe(true);
  });
});
