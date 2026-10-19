import { ConfigService } from './config.service';

const KEYS = [
  'PORT',
  'DATA_DIR',
  'OFCP_GATEWAY_URL',
  'OFCP_SALESCHANNEL_API_KEY',
  'GUEST_SESSION_TTL_DAYS',
  'SESSION_TTL_DAYS',
  'USER_TTL_DAYS',
  'WHITELABEL_SHARE_SECRET',
  'DUMMY_ITEM_START_PRICE',
  'DUMMY_ITEM_INCREASE_PERCENT',
  'DUMMY_ITEM_END_PRICE',
] as const;

describe('ConfigService', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('falls back to the default when a required string is unset', () => {
    expect(new ConfigService().DATA_DIR).toBe('./data');
  });

  it('treats an empty string as missing', () => {
    process.env.DATA_DIR = '';
    expect(() => new ConfigService().DATA_DIR).toThrow('DATA_DIR');
  });

  it('returns required strings verbatim', () => {
    process.env.DATA_DIR = '/srv/ofcp-demo';
    expect(new ConfigService().DATA_DIR).toBe('/srv/ofcp-demo');
  });

  it('strips trailing slashes from the gateway URL', () => {
    process.env.OFCP_GATEWAY_URL = 'https://gateway.test///';
    expect(new ConfigService().OFCP_GATEWAY_URL).toBe('https://gateway.test');
  });

  it('parses required positive numbers', () => {
    process.env.PORT = '4000';
    expect(new ConfigService().PORT).toBe(4000);
  });

  it('rejects non-numeric, zero and negative numbers', () => {
    const config = new ConfigService();
    for (const bad of ['abc', '0', '-5']) {
      process.env.GUEST_SESSION_TTL_DAYS = bad;
      expect(() => config.GUEST_SESSION_TTL_DAYS).toThrow(
        'GUEST_SESSION_TTL_DAYS',
      );
    }
  });

  it('returns undefined for unset or empty optional secrets', () => {
    expect(new ConfigService().WHITELABEL_SHARE_SECRET).toBeUndefined();
    expect(new ConfigService().OFCP_SALESCHANNEL_API_KEY).toBeUndefined();
    process.env.WHITELABEL_SHARE_SECRET = '';
    expect(new ConfigService().WHITELABEL_SHARE_SECRET).toBeUndefined();
  });

  it('reads lazily: values set after construction are visible', () => {
    const config = new ConfigService();
    process.env.DATA_DIR = '/tmp/lazy';
    expect(config.DATA_DIR).toBe('/tmp/lazy');
  });

  it('validate() surfaces an invalid required variable', () => {
    process.env.PORT = 'not-a-number';
    expect(() => new ConfigService().validate()).toThrow('PORT');
  });

  it('reads the dummy catalog price parameters from the environment', () => {
    process.env.DUMMY_ITEM_START_PRICE = '10';
    process.env.DUMMY_ITEM_INCREASE_PERCENT = '50';
    process.env.DUMMY_ITEM_END_PRICE = '33.75';
    const config = new ConfigService();
    expect(config.DUMMY_ITEM_START_PRICE).toBe(10);
    expect(config.DUMMY_ITEM_INCREASE_PERCENT).toBe(50);
    expect(config.DUMMY_ITEM_END_PRICE).toBe(33.75);
    process.env.DUMMY_ITEM_INCREASE_PERCENT = '0';
    expect(() => config.DUMMY_ITEM_INCREASE_PERCENT).toThrow(
      'DUMMY_ITEM_INCREASE_PERCENT',
    );
  });
});
