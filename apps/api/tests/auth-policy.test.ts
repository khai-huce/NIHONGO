import { describe, expect, it } from 'vitest';
import { registerSchema, loginSchema } from '../src/modules/auth/auth.schema.js';

describe('registration password boundaries and existing login compatibility', () => {
  const account = { name: 'Học viên', email: 'policy@example.test' };
  it('accepts the advertised 12 and 128 character boundaries', () => {
    for (const length of [12, 128]) expect(registerSchema.safeParse({ ...account, password: 'a'.repeat(length) }).success).toBe(true);
  });
  it('rejects passwords outside the advertised registration boundaries', () => {
    for (const length of [0, 11, 129]) expect(registerSchema.safeParse({ ...account, password: 'a'.repeat(length) }).success).toBe(false);
  });
  it('does not apply new-account length requirements to existing login', () => {
    expect(loginSchema.safeParse({ email: account.email, password: 'old-pass' }).success).toBe(true);
    expect(loginSchema.safeParse({ email: account.email, password: '' }).success).toBe(false);
  });
});

