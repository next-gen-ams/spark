import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REMEMBER_ACCESS_MS,
  createRememberedAccess,
  derivePasswordVerifier,
  hasValidRememberedAccess,
  verifyDashboardPassword,
} from './auth-verifier.js';

test('accepts only the password matching a PBKDF2 verifier', async () => {
  const fixture = {
    iterations: 1000,
    salt: 'dGVzdC1zYWx0',
  };
  fixture.verifier = await derivePasswordVerifier('fixture-password', fixture);

  assert.equal(await verifyDashboardPassword('fixture-password', fixture), true);
  assert.equal(await verifyDashboardPassword('wrong-password', fixture), false);
  assert.equal(await verifyDashboardPassword('', fixture), false);
});

test('remembered access expires after seven days', () => {
  const now = Date.parse('2026-09-29T00:00:00.000Z');
  const remembered = createRememberedAccess(now);

  assert.equal(hasValidRememberedAccess(remembered, now + REMEMBER_ACCESS_MS - 1), true);
  assert.equal(hasValidRememberedAccess(remembered, now + REMEMBER_ACCESS_MS), false);
  assert.equal(hasValidRememberedAccess('invalid-json', now), false);
});
