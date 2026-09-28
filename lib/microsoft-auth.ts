'use client';

import {
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
} from '@azure/msal-browser';
import {
  authRecoveryForError,
  microsoftErrorCode,
  MicrosoftReauthenticationRequiredError,
} from '@/lib/microsoft-auth-policy';

const clientId = process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID ?? '';
const tenantId = process.env.NEXT_PUBLIC_MICROSOFT_TENANT_ID ?? '';
const appBasePath = process.env.NEXT_PUBLIC_APP_BASE_PATH ?? '';

const loginScopes = ['User.Read'];
let clientPromise: Promise<PublicClientApplication> | null = null;

export type MicrosoftProfile = {
  displayName: string;
  email: string;
  id: string;
};

export const microsoftAuthConfigured = Boolean(clientId && tenantId);

function redirectUri() {
  return `${window.location.origin}${window.location.pathname}`;
}

function silentRedirectUri() {
  return `${window.location.origin}${appBasePath}/auth-silent.html`;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function getClient() {
  if (!microsoftAuthConfigured)
    throw new Error('Microsoft sign-in is not configured.');
  if (!clientPromise) {
    clientPromise = (async () => {
      const client = new PublicClientApplication({
        auth: {
          clientId,
          authority: `https://login.microsoftonline.com/${tenantId}`,
          redirectUri: redirectUri(),
          postLogoutRedirectUri: redirectUri(),
        },
        cache: { cacheLocation: 'localStorage' },
      });
      await client.initialize();
      return client;
    })();
  }
  return clientPromise;
}

function profileFromAccount(account: AccountInfo): MicrosoftProfile {
  return {
    id: account.localAccountId || account.homeAccountId,
    displayName: account.name || account.username || 'Microsoft user',
    email: account.username,
  };
}

async function acquireToken(scopes: string[]) {
  const client = await getClient();
  const account = client.getActiveAccount() ?? client.getAllAccounts()[0];
  if (!account)
    throw new Error(
      'Connect Microsoft before accessing the shared EMT workspace.',
    );
  client.setActiveAccount(account);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await client.acquireTokenSilent({
        account,
        scopes,
        redirectUri: silentRedirectUri(),
      });
      return response.accessToken;
    } catch (error) {
      const recovery =
        error instanceof InteractionRequiredAuthError
          ? 'interactive'
          : authRecoveryForError(error);
      if (recovery === 'retry-then-interactive' && attempt === 0) {
        await wait(350);
        continue;
      }
      if (recovery === 'interactive' || recovery === 'retry-then-interactive')
        throw new MicrosoftReauthenticationRequiredError(
          microsoftErrorCode(error),
        );
      throw error;
    }
  }
  throw new MicrosoftReauthenticationRequiredError('timed_out');
}

export async function restoreMicrosoftSession() {
  if (!microsoftAuthConfigured) return null;
  const client = await getClient();
  let redirectResponse;
  try {
    redirectResponse = await client.handleRedirectPromise();
  } catch (error) {
    const recovery =
      error instanceof InteractionRequiredAuthError
        ? 'interactive'
        : authRecoveryForError(error);
    if (recovery !== 'none')
      throw new MicrosoftReauthenticationRequiredError(
        microsoftErrorCode(error),
      );
    throw error;
  }
  const account =
    redirectResponse?.account ??
    client.getActiveAccount() ??
    client.getAllAccounts()[0];
  if (!account) return null;
  client.setActiveAccount(account);
  return profileFromAccount(account);
}

export async function connectMicrosoft() {
  const client = await getClient();
  const account = client.getActiveAccount() ?? client.getAllAccounts()[0];
  if (account) {
    client.setActiveAccount(account);
    await client.acquireTokenRedirect({
      account,
      scopes: loginScopes,
      redirectUri: redirectUri(),
    });
    return;
  }
  await client.loginRedirect({
    scopes: loginScopes,
    redirectUri: redirectUri(),
  });
}

export async function getMicrosoftAccessToken() {
  return acquireToken(loginScopes);
}

export async function disconnectMicrosoft() {
  const client = await getClient();
  const account = client.getActiveAccount() ?? client.getAllAccounts()[0];
  await client.logoutRedirect({
    account,
    postLogoutRedirectUri: redirectUri(),
  });
}
