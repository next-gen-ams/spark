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
        cache: { cacheLocation: 'sessionStorage' },
      });
      await client.initialize();
      return client;
    })();
  }
  return clientPromise;
}

async function acquireProfile(
  client: PublicClientApplication,
  account: AccountInfo,
) {
  client.setActiveAccount(account);
  let accessToken: string;
  try {
    const response = await client.acquireTokenSilent({
      account,
      scopes: loginScopes,
    });
    accessToken = response.accessToken;
  } catch (error) {
    if (!(error instanceof InteractionRequiredAuthError)) throw error;
    await client.acquireTokenRedirect({
      account,
      scopes: loginScopes,
      redirectUri: redirectUri(),
    });
    return null;
  }

  const response = await fetch(
    'https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName',
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok)
    throw new Error(
      `Microsoft Graph profile check failed (${response.status}).`,
    );
  const profile = (await response.json()) as {
    id: string;
    displayName?: string;
    mail?: string;
    userPrincipalName?: string;
  };
  return {
    id: profile.id,
    displayName: profile.displayName || account.name || 'Microsoft user',
    email: profile.mail || profile.userPrincipalName || account.username,
  } satisfies MicrosoftProfile;
}

export async function restoreMicrosoftSession() {
  if (!microsoftAuthConfigured) return null;
  const client = await getClient();
  const redirectResponse = await client.handleRedirectPromise();
  const account =
    redirectResponse?.account ??
    client.getActiveAccount() ??
    client.getAllAccounts()[0];
  return account ? acquireProfile(client, account) : null;
}

export async function connectMicrosoft() {
  const client = await getClient();
  await client.loginRedirect({
    scopes: loginScopes,
    redirectUri: redirectUri(),
  });
}

export async function getMicrosoftAccessToken() {
  const client = await getClient();
  const account = client.getActiveAccount() ?? client.getAllAccounts()[0];
  if (!account)
    throw new Error(
      'Connect Microsoft before accessing the shared EMT workspace.',
    );
  try {
    const response = await client.acquireTokenSilent({
      account,
      scopes: loginScopes,
    });
    return response.accessToken;
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
