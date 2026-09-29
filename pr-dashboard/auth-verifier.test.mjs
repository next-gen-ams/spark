import test from 'node:test';
import assert from 'node:assert/strict';
import { derivePasswordVerifier, verifyDashboardPassword } from './auth-verifier.js';

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
