import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.117.1';

const MICROSOFT_TENANT_ID = '21929f4e-000b-4629-892c-20bdc32ac14e';
const MICROSOFT_CLIENT_ID = '1d5c5c18-5e44-421a-968b-508f287778ac';
const WORKSPACE_ID = 'gms-emt';
const ALLOWED_ORIGINS = new Set([
  'https://spark.kmt.global',
  'http://localhost:3000',
  'http://localhost:8791',
]);
const BUCKETS = new Set(['agenda', 'backlog', 'history']);
const STATUSES = new Set(['Scheduled', 'Needs lead', 'Needs input']);
const APPROVED_EMAILS = new Set([
  'lisa.xu@gms.global',
  'george@gms.global',
  'brenda@gms.global',
  'coco.hu@gms.global',
]);

type MicrosoftProfile = {
  id: string;
  displayName: string;
  email: string;
};

type TopicInput = {
  id?: number;
  bucket?: string;
  title?: string;
  category?: string;
  status?: string;
  lead?: string;
  leadInitials?: string;
  time?: string;
  note?: string;
  reminder?: string;
  prepAction?: string;
  decision?: string;
  followUpOwner?: string;
  followUpAction?: string;
  dueDate?: string;
  decisionDateIso?: string;
  source?: string;
  remindLead?: boolean;
  remindFollowup?: boolean;
};

function corsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
    Vary: 'Origin',
  };
}

function json(origin: string, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(origin),
  });
}

function decodeClaims(token: string) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Microsoft token format is invalid.');
  const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  return JSON.parse(atob(padded)) as Record<string, unknown>;
}

function requiredString(value: unknown, field: string, max: number) {
  if (typeof value !== 'string' || !value.trim())
    throw new Error(`${field} is required.`);
  if (value.trim().length > max) throw new Error(`${field} is too long.`);
  return value.trim();
}

function optionalString(value: unknown, field: string, max: number) {
  if (value == null) return '';
  if (typeof value !== 'string') throw new Error(`${field} must be text.`);
  if (value.length > max) throw new Error(`${field} is too long.`);
  return value.trim();
}

function optionalDate(value: unknown, field: string) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${field} must use YYYY-MM-DD.`);
  }
  return value;
}

function minutesFrom(value: unknown) {
  const minutes =
    typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) {
    throw new Error('Time must be between 1 and 180 minutes.');
  }
  return minutes;
}

function topicPayload(
  input: TopicInput,
  profile: MicrosoftProfile,
  allowedCategories: Set<string>,
  includeId = false,
) {
  const bucket = requiredString(input.bucket ?? 'agenda', 'Bucket', 20);
  const category = requiredString(input.category, 'Category', 40);
  const status = requiredString(input.status ?? 'Scheduled', 'Status', 30);
  if (!BUCKETS.has(bucket)) throw new Error('Bucket is invalid.');
  if (!allowedCategories.has(category)) throw new Error('Category is invalid.');
  if (!STATUSES.has(status)) throw new Error('Status is invalid.');

  const payload: Record<string, unknown> = {
    bucket,
    title: requiredString(input.title, 'Title', 160),
    category,
    status,
    lead: requiredString(input.lead, 'Lead', 120),
    lead_initials: requiredString(input.leadInitials, 'Lead initials', 8),
    time_minutes: minutesFrom(input.time),
    note: optionalString(input.note, 'Note', 4000),
    reminder: optionalString(input.reminder, 'Reminder', 160),
    prep_action: optionalString(input.prepAction, 'Preparation action', 4000),
    decision: optionalString(input.decision, 'Decision', 8000),
    follow_up_owner: optionalString(
      input.followUpOwner,
      'Follow-up owner',
      120,
    ),
    follow_up_action: optionalString(
      input.followUpAction,
      'Follow-up action',
      4000,
    ),
    due_date: optionalDate(input.dueDate, 'Due date'),
    decision_date: optionalDate(input.decisionDateIso, 'Decision date'),
    source: optionalString(input.source || 'Agenda', 'Source', 80),
    remind_lead: Boolean(input.remindLead),
    remind_followup: Boolean(input.remindFollowup),
    updated_by: profile.email,
    updated_at: new Date().toISOString(),
  };
  if (includeId) {
    if (!Number.isSafeInteger(input.id) || Number(input.id) <= 0)
      throw new Error('Topic ID is invalid.');
    payload.id = input.id;
  }
  return payload;
}

function mapTopic(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    bucket: row.bucket,
    title: row.title,
    category: row.category,
    status: row.status,
    lead: row.lead,
    leadInitials: row.lead_initials,
    time: `${row.time_minutes} min`,
    note: row.note,
    reminder: row.reminder,
    prepAction: row.prep_action,
    decision: row.decision,
    followUpOwner: row.follow_up_owner,
    followUpAction: row.follow_up_action,
    dueDate: row.due_date || '',
    decisionDateIso: row.decision_date || undefined,
    decisionDate: row.decision_date || undefined,
    source: row.source,
    remindLead: row.remind_lead,
    remindFollowup: row.remind_followup,
  };
}

function mapSettings(row: Record<string, unknown>) {
  return {
    remindersOn: row.reminders_on,
    agendaReminderTiming: row.agenda_reminder_timing,
    followupReminderTiming: row.followup_reminder_timing,
    overdueRemindersOn: row.overdue_reminders_on,
    businessDaysOnly: row.business_days_only,
  };
}

function mapCategory(row: Record<string, unknown>, usageCount = 0) {
  return {
    id: Number(row.id),
    name: String(row.name),
    sortOrder: Number(row.sort_order),
    active: Boolean(row.active),
    system: Boolean(row.system),
    usageCount,
  };
}

async function getAllowedCategories(database: ReturnType<typeof createClient>) {
  const { data, error } = await database
    .from('emt_topic_categories')
    .select('name,active,system');
  if (error) throw error;
  return new Set(
    (data || [])
      .filter((category) => category.active || category.system)
      .map((category) => String(category.name)),
  );
}

async function authenticate(
  request: Request,
  database: ReturnType<typeof createClient>,
): Promise<MicrosoftProfile> {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer '))
    throw new Error('Microsoft sign-in is required.');
  const token = authorization.slice(7);
  const claims = decodeClaims(token);
  const tenantId = String(claims.tid || '');
  const clientId = String(claims.azp || claims.appid || '');
  if (tenantId !== MICROSOFT_TENANT_ID || clientId !== MICROSOFT_CLIENT_ID) {
    throw new Error('This Microsoft token was not issued for EMT Tracker.');
  }

  const graphResponse = await fetch(
    'https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName',
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!graphResponse.ok)
    throw new Error('Microsoft could not verify this account.');
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
  if (!id || !displayName || !APPROVED_EMAILS.has(email)) {
    throw new Error('This Microsoft account is not approved for EMT Tracker.');
  }

  const { data: member, error } = await database
    .from('emt_members')
    .select('display_name,email,microsoft_object_id,active,first_connected_at')
    .eq('email', email)
    .maybeSingle();
  if (error) throw error;
  if (!member?.active)
    throw new Error('This account is not on the EMT member list.');
  if (member.email && member.email.toLowerCase() !== email) {
    throw new Error(
      'This account does not match the approved EMT member record.',
    );
  }
  if (member.microsoft_object_id && member.microsoft_object_id !== id) {
    throw new Error(
      'This account does not match the approved Microsoft identity.',
    );
  }

  const now = new Date().toISOString();
  const { error: memberUpdateError } = await database
    .from('emt_members')
    .update({
      email,
      microsoft_object_id: id,
      first_connected_at: member.first_connected_at || now,
      last_connected_at: now,
    })
    .eq('email', email);
  if (memberUpdateError) throw memberUpdateError;
  return { id, displayName, email };
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin') || '';
  if (!ALLOWED_ORIGINS.has(origin))
    return new Response('Origin not allowed', { status: 403 });
  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== 'GET' && request.method !== 'POST') {
    return json(origin, { error: 'Method not allowed.' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey)
      throw new Error('Database service is not configured.');
    const database = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const profile = await authenticate(request, database);

    if (request.method === 'GET') {
      const [topicsResult, settingsResult, categoriesResult] =
        await Promise.all([
          database
            .from('emt_topics')
            .select('*')
            .order('id', { ascending: true }),
          database
            .from('emt_settings')
            .select('*')
            .eq('workspace_id', WORKSPACE_ID)
            .single(),
          database
            .from('emt_topic_categories')
            .select('*')
            .order('sort_order', { ascending: true }),
        ]);
      if (topicsResult.error) throw topicsResult.error;
      if (settingsResult.error) throw settingsResult.error;
      if (categoriesResult.error) throw categoriesResult.error;
      const categoryUsage = new Map<string, number>();
      for (const topic of topicsResult.data || []) {
        const category = String(topic.category);
        categoryUsage.set(category, (categoryUsage.get(category) || 0) + 1);
      }
      return json(origin, {
        profile,
        topics: (topicsResult.data || []).map((row) =>
          mapTopic(row as Record<string, unknown>),
        ),
        settings: mapSettings(settingsResult.data as Record<string, unknown>),
        categories: (categoriesResult.data || []).map((row) =>
          mapCategory(
            row as Record<string, unknown>,
            categoryUsage.get(String(row.name)) || 0,
          ),
        ),
      });
    }

    const body = (await request.json()) as {
      action?: string;
      topic?: TopicInput;
      settings?: Record<string, unknown>;
      id?: number;
      name?: string;
    };

    if (body.action === 'create_topic') {
      const payload = topicPayload(
        body.topic || {},
        profile,
        await getAllowedCategories(database),
      );
      const { data, error } = await database
        .from('emt_topics')
        .insert({ ...payload, created_by: profile.email })
        .select('*')
        .single();
      if (error) throw error;
      return json(
        origin,
        { topic: mapTopic(data as Record<string, unknown>) },
        201,
      );
    }

    if (body.action === 'save_topic') {
      const payload = topicPayload(
        body.topic || {},
        profile,
        await getAllowedCategories(database),
        true,
      );
      const id = payload.id;
      delete payload.id;
      const { data, error } = await database
        .from('emt_topics')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return json(origin, { topic: mapTopic(data as Record<string, unknown>) });
    }

    if (body.action === 'save_settings') {
      const settings = body.settings || {};
      const payload = {
        reminders_on: Boolean(settings.remindersOn),
        agenda_reminder_timing: requiredString(
          settings.agendaReminderTiming,
          'Agenda reminder timing',
          80,
        ),
        followup_reminder_timing: requiredString(
          settings.followupReminderTiming,
          'Follow-up reminder timing',
          80,
        ),
        overdue_reminders_on: Boolean(settings.overdueRemindersOn),
        business_days_only: Boolean(settings.businessDaysOnly),
        updated_by: profile.email,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await database
        .from('emt_settings')
        .update(payload)
        .eq('workspace_id', WORKSPACE_ID)
        .select('*')
        .single();
      if (error) throw error;
      return json(origin, {
        settings: mapSettings(data as Record<string, unknown>),
      });
    }

    if (body.action === 'create_category') {
      const name = requiredString(body.name, 'Topic name', 40);
      const { data: existing, error: existingError } = await database
        .from('emt_topic_categories')
        .select('*')
        .ilike('name', name)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing?.active || existing?.system)
        throw new Error('A topic with this name already exists.');
      const { data: lastCategory, error: orderError } = await database
        .from('emt_topic_categories')
        .select('sort_order')
        .eq('active', true)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (orderError) throw orderError;
      if (existing) {
        const { data, error } = await database
          .from('emt_topic_categories')
          .update({
            active: true,
            sort_order: Number(lastCategory?.sort_order || 0) + 10,
            updated_by: profile.email,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select('*')
          .single();
        if (error) throw error;
        return json(
          origin,
          { category: mapCategory(data as Record<string, unknown>) },
          201,
        );
      }
      const { data, error } = await database
        .from('emt_topic_categories')
        .insert({
          name,
          sort_order: Number(lastCategory?.sort_order || 0) + 10,
          created_by: profile.email,
          updated_by: profile.email,
        })
        .select('*')
        .single();
      if (error) throw error;
      return json(
        origin,
        { category: mapCategory(data as Record<string, unknown>) },
        201,
      );
    }

    if (body.action === 'rename_category') {
      if (!Number.isSafeInteger(body.id) || Number(body.id) <= 0)
        throw new Error('Topic ID is invalid.');
      const name = requiredString(body.name, 'Topic name', 40);
      const { data, error } = await database.rpc('emt_rename_category', {
        p_id: body.id,
        p_name: name,
        p_updated_by: profile.email,
      });
      if (error) throw error;
      return json(origin, {
        category: mapCategory(data as Record<string, unknown>),
      });
    }

    if (body.action === 'delete_category') {
      if (!Number.isSafeInteger(body.id) || Number(body.id) <= 0)
        throw new Error('Topic ID is invalid.');
      const { data, error } = await database.rpc('emt_delete_category', {
        p_id: body.id,
        p_updated_by: profile.email,
      });
      if (error) throw error;
      return json(origin, data as Record<string, unknown>);
    }

    return json(origin, { error: 'Action is not supported.' }, 400);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'The EMT workspace request failed.';
    const status = /required|approved|issued|match|verify/i.test(message)
      ? 401
      : 400;
    return json(origin, { error: message }, status);
  }
});
