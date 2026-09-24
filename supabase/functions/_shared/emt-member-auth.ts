import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.117.1';

export const EMT_ALLOWED_ORIGINS = new Set([
  'https://spark.kmt.global',
  'http://localhost:3000',
  'http://localhost:4179',
  'http://localhost:4180',
  'http://localhost:8791',
]);

export type EmtMemberProfile = {
  id: string;
  displayName: string;
  email: string;
};

export class EmtHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

export function emtCorsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
    Vary: 'Origin',
  };
}

export function emtJson(origin: string, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: emtCorsHeaders(origin),
  });
}

export function emtErrorResponse(origin: string, error: unknown) {
  if (error instanceof EmtHttpError) {
    return emtJson(
      origin,
      { error: { code: error.code, message: error.message } },
      error.status,
    );
  }
  console.error('EMT function failed', {
    message: error instanceof Error ? error.message : 'Unknown error',
  });
  return emtJson(
    origin,
    {
      error: {
        code: 'internal_error',
        message: 'The EMT service could not complete this request.',
      },
    },
    500,
  );
}

function decodeClaims(token: string) {
  const parts = token.split('.');
  if (parts.length !== 3)
    throw new EmtHttpError(
      'Microsoft sign-in is invalid.',
      401,
      'invalid_token',
    );
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    throw new EmtHttpError(
      'Microsoft sign-in is invalid.',
      401,
      'invalid_token',
    );
  }
}

function claimString(claims: Record<string, unknown>, name: string) {
  return typeof claims[name] === 'string' ? claims[name] : '';
}

export function bearerToken(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer '))
    throw new EmtHttpError(
      'Microsoft sign-in is required.',
      401,
      'authentication_required',
    );
  const token = authorization.slice(7).trim();
  if (!token || token.length > 16_384)
    throw new EmtHttpError(
      'Microsoft sign-in is invalid.',
      401,
      'invalid_token',
    );
  return token;
}

export async function authenticateEmtMember(
  request: Request,
  database: SupabaseClient,
): Promise<EmtMemberProfile> {
  const token = bearerToken(request);
  const claims = decodeClaims(token);
  const tenantId = Deno.env.get('MICROSOFT_TENANT_ID') || '';
  const clientId = Deno.env.get('MICROSOFT_CLIENT_ID') || '';
  if (!tenantId || !clientId)
    throw new Error('Microsoft identity configuration is missing.');
  if (
    claimString(claims, 'tid') !== tenantId ||
    (claimString(claims, 'azp') || claimString(claims, 'appid')) !== clientId
  ) {
    throw new EmtHttpError(
      'This Microsoft token was not issued for EMT Tracker.',
      401,
      'wrong_application',
    );
  }

  const graphResponse = await fetch(
    'https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName',
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!graphResponse.ok)
    throw new EmtHttpError(
      'Microsoft could not verify this account.',
      401,
      'profile_verification_failed',
    );
  const graphProfile = (await graphResponse.json()) as {
    id?: string;
    displayName?: string;
    mail?: string;
    userPrincipalName?: string;
  };
  const email = (
    graphProfile.mail ||
    graphProfile.userPrincipalName ||
    ''
  ).toLowerCase();
  const displayName = graphProfile.displayName || '';
  const id = graphProfile.id || '';
  if (!id || !displayName || !email)
    throw new EmtHttpError(
      'Microsoft did not return a complete work profile.',
      401,
      'incomplete_profile',
    );

  const { data: member, error } = await database
    .from('emt_members')
    .select('email,microsoft_object_id,active,first_connected_at')
    .eq('email', email)
    .maybeSingle();
  if (error) throw error;
  if (!member?.active)
    throw new EmtHttpError(
      'This account is not on the active EMT member list.',
      403,
      'member_not_allowed',
    );
  if (member.microsoft_object_id && member.microsoft_object_id !== id) {
    throw new EmtHttpError(
      'This account does not match the approved Microsoft identity.',
      403,
      'identity_mismatch',
    );
  }

  const now = new Date().toISOString();
  const { error: updateError } = await database
    .from('emt_members')
    .update({
      microsoft_object_id: id,
      first_connected_at: member.first_connected_at || now,
      last_connected_at: now,
    })
    .eq('email', email);
  if (updateError) throw updateError;
  return { id, displayName, email };
}
