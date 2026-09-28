export type MicrosoftAuthRecovery =
  | 'interactive'
  | 'retry-then-interactive'
  | 'none';

type ErrorWithCode = {
  errorCode?: unknown;
  code?: unknown;
};

const INTERACTIVE_ERROR_CODES = new Set([
  'consent_required',
  'interaction_required',
  'login_required',
  'no_account_error',
]);

const RETRYABLE_SILENT_ERROR_CODES = new Set([
  'monitor_window_timeout',
  'timed_out',
]);

export function microsoftErrorCode(error: unknown) {
  if (!error || typeof error !== 'object') return '';
  const candidate = error as ErrorWithCode;
  if (typeof candidate.errorCode === 'string') return candidate.errorCode;
  return typeof candidate.code === 'string' ? candidate.code : '';
}

export function authRecoveryForError(error: unknown): MicrosoftAuthRecovery {
  const code = microsoftErrorCode(error);
  if (INTERACTIVE_ERROR_CODES.has(code)) return 'interactive';
  if (RETRYABLE_SILENT_ERROR_CODES.has(code)) return 'retry-then-interactive';
  return 'none';
}

export class MicrosoftReauthenticationRequiredError extends Error {
  readonly code: string;

  constructor(code = 'interaction_required') {
    super(
      'Your Microsoft session needs a quick reconnect. Continue with Microsoft to reopen the workspace.',
    );
    this.name = 'MicrosoftReauthenticationRequiredError';
    this.code = code;
  }
}

export function isMicrosoftReauthenticationRequired(
  error: unknown,
): error is MicrosoftReauthenticationRequiredError {
  return error instanceof MicrosoftReauthenticationRequiredError;
}
