'use client';

import {
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
} from '@azure/msal-browser';

const clientId = process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID ?? '';
const tenantId = process.env.NEXT_PUBLIC_MICROSOFT_TENANT_ID ?? '';

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
  const response = await client.acquireTokenSilent({
    account,
    scopes,
  });
  return response.accessToken;
}

export async function restoreMicrosoftSession() {
  if (!microsoftAuthConfigured) return null;
  const client = await getClient();
  const redirectResponse = await client.handleRedirectPromise();
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
  await client.loginRedirect({
    scopes: loginScopes,
    redirectUri: redirectUri(),
  });
}

export async function getMicrosoftAccessToken() {
  try {
    return await acquireToken(loginScopes);
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      throw new Error('Your Microsoft session needs to be reconnected.');
    }
    throw error;
  }
}

export async function disconnectMicrosoft() {
  const client = await getClient();
  const account = client.getActiveAccount() ?? client.getAllAccounts()[0];
  await client.logoutRedirect({
    account,
    postLogoutRedirectUri: redirectUri(),
  });
}
