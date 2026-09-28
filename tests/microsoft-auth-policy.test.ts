import assert from 'node:assert/strict';
import test from 'node:test';
import {
  authRecoveryForError,
  MicrosoftReauthenticationRequiredError,
} from '../lib/microsoft-auth-policy.ts';

void test('retries a silent timeout once before requiring interaction', () => {
  assert.equal(
    authRecoveryForError({ errorCode: 'timed_out' }),
    'retry-then-interactive',
  );
  assert.equal(
    authRecoveryForError({ errorCode: 'monitor_window_timeout' }),
    'retry-then-interactive',
  );
});

void test('moves Microsoft interaction errors directly to interactive recovery', () => {
  assert.equal(
    authRecoveryForError({ errorCode: 'interaction_required' }),
    'interactive',
  );
  assert.equal(
    authRecoveryForError({ errorCode: 'login_required' }),
    'interactive',
  );
  assert.equal(
    authRecoveryForError({ errorCode: 'consent_required' }),
    'interactive',
  );
});

void test('does not disguise ordinary network and API failures as sign-in expiry', () => {
  assert.equal(
    authRecoveryForError({ errorCode: 'no_network_connectivity' }),
    'none',
  );
  assert.equal(authRecoveryForError(new Error('API unavailable')), 'none');
});

void test('marks the recovery error so the UI can offer a real Microsoft redirect', () => {
  const error = new MicrosoftReauthenticationRequiredError('timed_out');
  assert.equal(error.name, 'MicrosoftReauthenticationRequiredError');
  assert.equal(error.code, 'timed_out');
  assert.match(error.message, /Microsoft session/i);
});
