import { hashPassword, verifyPassword } from './password.util';

describe('password util', () => {
  it('verifies a correct password', () => {
    const stored = hashPassword('secret1');
    expect(stored).toContain(':');
    expect(verifyPassword('secret1', stored)).toBe(true);
  });

  it('rejects a wrong password', () => {
    expect(verifyPassword('wrong', hashPassword('secret1'))).toBe(false);
  });

  it('rejects malformed stored hashes', () => {
    expect(verifyPassword('secret1', 'garbage')).toBe(false);
  });
});
