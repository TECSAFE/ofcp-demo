import { Injectable } from '@nestjs/common';
import { DEFAULT_DUMMY_ITEM_SETTINGS } from '../../products/dummy-items';

/**
 * Single home for every environment read of the demo API. No variable has a
 * code default: required values throw when missing, so misconfiguration
 * surfaces at boot (see validate()) instead of as silent fallback behavior.
 *
 * Values are read lazily (getters, not constructor-time fields) because the
 * test suites mutate process.env per test — e.g. the whitelabel e2e deletes
 * the share secret at runtime to assert the 503 path.
 */
@Injectable()
export class ConfigService {
  private require(name: string, def?: string): string {
    const value = process.env[name] ?? def;
    if (value === undefined || value === '') {
      throw new Error(`Required environment variable ${name} is not set`);
    }
    return value;
  }

  private requirePositiveNumber(name: string, def?: string): number {
    const n = Number(this.require(name, def));
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error(`Environment variable ${name} must be a positive number`);
    }
    return n;
  }

  private optional(name: string): string | undefined {
    return process.env[name] || undefined;
  }

  get PORT(): number {
    return this.requirePositiveNumber('PORT', '4000');
  }

  get DATA_DIR(): string {
    return this.require('DATA_DIR', './data');
  }

  get OFCP_GATEWAY_URL(): string {
    return this.require('OFCP_GATEWAY_URL', 'http://localhost:4000').replace(
      /\/+$/,
      '',
    );
  }

  get GUEST_SESSION_TTL_DAYS(): number {
    return this.requirePositiveNumber('GUEST_SESSION_TTL_DAYS', '1');
  }

  get SESSION_TTL_DAYS(): number {
    return this.requirePositiveNumber('SESSION_TTL_DAYS', '2');
  }

  get USER_TTL_DAYS(): number {
    return this.requirePositiveNumber('USER_TTL_DAYS', '7');
  }

  /**
   * Absent-tolerant at request time so /tecsafe endpoints answer 503 instead
   * of crashing; validate() still requires it, so a real boot fails fast.
   */
  get OFCP_SALESCHANNEL_API_KEY(): string | undefined {
    return this.optional('OFCP_SALESCHANNEL_API_KEY');
  }

  /** Optional by design: POST /whitelabel-shares answers 503 until this is set. */
  get WHITELABEL_SHARE_SECRET(): string | undefined {
    return this.optional('WHITELABEL_SHARE_SECRET');
  }

  get DUMMY_ITEM_START_PRICE(): number {
    return this.requirePositiveNumber(
      'DUMMY_ITEM_START_PRICE',
      String(DEFAULT_DUMMY_ITEM_SETTINGS.startPrice),
    );
  }

  get DUMMY_ITEM_INCREASE_PERCENT(): number {
    return this.requirePositiveNumber(
      'DUMMY_ITEM_INCREASE_PERCENT',
      String(DEFAULT_DUMMY_ITEM_SETTINGS.increasePercent),
    );
  }

  get DUMMY_ITEM_END_PRICE(): number {
    return this.requirePositiveNumber(
      'DUMMY_ITEM_END_PRICE',
      String(DEFAULT_DUMMY_ITEM_SETTINGS.endPrice),
    );
  }

  /** Touch every required getter so a bad deployment fails at boot. */
  validate(): void {
    void this.PORT;
    void this.DATA_DIR;
    void this.OFCP_GATEWAY_URL;
    void this.GUEST_SESSION_TTL_DAYS;
    void this.SESSION_TTL_DAYS;
    void this.USER_TTL_DAYS;
    void this.DUMMY_ITEM_START_PRICE;
    void this.DUMMY_ITEM_INCREASE_PERCENT;
    void this.DUMMY_ITEM_END_PRICE;
    // Not a getter read: the getter tolerates absence, boot does not.
    this.require('OFCP_SALESCHANNEL_API_KEY');
  }
}
