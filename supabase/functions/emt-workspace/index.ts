import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.117.1';
import { isWeeklyMeetingDate } from '../_shared/emt-meeting-schedule.ts';
import { completionRequest } from '../_shared/emt-completion.ts';
import {
  authenticateEmtMember,
  EMT_ALLOWED_ORIGINS,
  EmtHttpError,
  type EmtMemberProfile as MicrosoftProfile,
} from '../_shared/emt-member-auth.ts';

const BUCKETS = new Set(['agenda', 'backlog', 'history']);
const STATUSES = new Set(['Scheduled', 'Needs lead', 'Needs input']);

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
  prepAction?: string;
  decision?: string;
  followUpOwner?: string;
  followUpAction?: string;
  dueDate?: string;
  decisionDateIso?: string;
  meetingDate?: string;
  source?: string;
};

const MELBOURNE_TIME_ZONE = 'Australia/Melbourne';

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
  const parsed = new Date(`${value}T00:00:00Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    throw new Error(`${field} is invalid.`);
  return value;
}

function localIsoDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: MELBOURNE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function validateMeetingDate(
  value: unknown,
  bucket: string,
  meetingAnchorDate: string,
) {
  const meetingDate = optionalDate(value, 'Meeting date');
  if (bucket === 'backlog') return null;
  if (bucket === 'agenda' && !meetingDate)
    throw new Error('Agenda topics require a meeting date.');
  if (!meetingDate) return null;
  if (!isWeeklyMeetingDate(meetingDate, meetingAnchorDate))
    throw new Error('Meeting date must follow the weekly EMT schedule.');
  if (bucket === 'agenda' && meetingDate < localIsoDate())
    throw new Error('Past meetings cannot receive agenda topics.');
  return meetingDate;
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
  allowedLeads: Set<string>,
  meetingAnchorDate: string,
  includeId = false,
) {
  const bucket = requiredString(input.bucket ?? 'agenda', 'Bucket', 20);
  const category = requiredString(input.category, 'Category', 40);
  const status = requiredString(input.status ?? 'Scheduled', 'Status', 30);
  if (!BUCKETS.has(bucket)) throw new Error('Bucket is invalid.');
  if (!allowedCategories.has(category)) throw new Error('Category is invalid.');
  if (!STATUSES.has(status)) throw new Error('Status is invalid.');
  const lead = requiredString(input.lead, 'Lead', 120);
  if (!allowedLeads.has(lead))
    throw new Error('Proposer is not an active EMT member.');

  const payload: Record<string, unknown> = {
    bucket,
    title: requiredString(input.title, 'Title', 160),
    category,
    status,
    lead,
    lead_initials: requiredString(input.leadInitials, 'Lead initials', 8),
    time_minutes: minutesFrom(input.time),
    note: optionalString(input.note, 'Note', 4000),
    reminder: 'Managed in global reminder settings',
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
    meeting_date: validateMeetingDate(
      input.meetingDate,
      bucket,
      meetingAnchorDate,
    ),
    source: optionalString(input.source || 'Agenda', 'Source', 80),
    remind_lead: false,
    remind_followup: false,
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
    prepAction: row.prep_action,
    decision: row.decision,
    followUpOwner: row.follow_up_owner,
    followUpAction: row.follow_up_action,
    completedAt: row.completed_at || undefined,
    completedBy: row.completed_by || undefined,
    dueDate: row.due_date || '',
    decisionDateIso: row.decision_date || undefined,
    decisionDate: row.decision_date || undefined,
    meetingDate: row.meeting_date || undefined,
    source: row.source,
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

async function getAllowedLeads(database: ReturnType<typeof createClient>) {
  const { data, error } = await database
    .from('emt_members')
    .select('display_name')
    .eq('active', true);
  if (error) throw error;
  return new Set((data || []).map((member) => String(member.display_name)));
}

async function getMeetingAnchorDate(database: ReturnType<typeof createClient>) {
  const { data, error } = await database
    .from('emt_settings')
    .select('meeting_anchor_date')
    .eq('workspace_id', 'gms-emt')
    .single();
  if (error) throw error;
  return String(data.meeting_anchor_date);
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin') || '';
  if (!EMT_ALLOWED_ORIGINS.has(origin))
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
    const profile = await authenticateEmtMember(request, database);

    if (request.method === 'GET') {
      const today = localIsoDate();
      const { error: rolloverError } = await database.rpc(
        'emt_recycle_expired_agenda',
        { reference_date: today },
      );
      if (rolloverError) throw rolloverError;
      const [
        topicsResult,
        settingsResult,
        workspaceSettingsResult,
        categoriesResult,
        membersResult,
      ] = await Promise.all([
        database
          .from('emt_topics')
          .select('*')
          .order('id', { ascending: true }),
        database
          .from('emt_member_settings')
          .select('*')
          .eq('member_email', profile.email)
          .maybeSingle(),
        database
          .from('emt_settings')
          .select('meeting_anchor_date')
          .eq('workspace_id', 'gms-emt')
          .single(),
        database
          .from('emt_topic_categories')
          .select('*')
          .order('sort_order', { ascending: true }),
        database
          .from('emt_members')
          .select('display_name,email')
          .eq('active', true)
          .not('email', 'is', null)
          .order('created_at', { ascending: true }),
      ]);
      if (topicsResult.error) throw topicsResult.error;
      if (settingsResult.error) throw settingsResult.error;
      if (workspaceSettingsResult.error) throw workspaceSettingsResult.error;
      if (categoriesResult.error) throw categoriesResult.error;
      if (membersResult.error) throw membersResult.error;
      const categoryUsage = new Map<string, number>();
      for (const topic of topicsResult.data || []) {
        const category = String(topic.category);
        categoryUsage.set(category, (categoryUsage.get(category) || 0) + 1);
      }
      let memberSettings = settingsResult.data;
      if (!memberSettings) {
        const { data, error } = await database
          .from('emt_member_settings')
          .insert({
            member_email: profile.email,
            updated_by: profile.email,
          })
          .select('*')
          .single();
        if (error) throw error;
        memberSettings = data;
      }
      return json(origin, {
        profile,
        topics: (topicsResult.data || []).map((row) =>
          mapTopic(row as Record<string, unknown>),
        ),
        settings: mapSettings(memberSettings as Record<string, unknown>),
        schedule: {
          meetingAnchorDate: String(
            workspaceSettingsResult.data.meeting_anchor_date,
          ),
        },
        categories: (categoriesResult.data || []).map((row) =>
          mapCategory(
            row as Record<string, unknown>,
            categoryUsage.get(String(row.name)) || 0,
          ),
        ),
        members: (membersResult.data || []).map((member) => ({
          displayName: String(member.display_name),
          email: String(member.email).toLowerCase(),
        })),
      });
    }

    const body = (await request.json()) as {
      action?: string;
      topic?: TopicInput;
      settings?: Record<string, unknown>;
      id?: number;
      name?: string;
      complete?: boolean;
    };

    if (body.action === 'set_completion') {
      const input = completionRequest(body.id, body.complete);
      const { data, error } = await database.rpc(
        'emt_set_follow_up_completion',
        {
          topic_id: input.id,
          is_complete: input.complete,
          actor_email: profile.email,
        },
      );
      if (error) throw error;
      if (!data?.[0])
        throw new Error('Save a decision and assign a follow-up owner first.');
      return json(origin, {
        topic: mapTopic(data[0] as Record<string, unknown>),
      });
    }

    if (body.action === 'create_topic') {
      const [allowedCategories, allowedLeads, meetingAnchorDate] =
        await Promise.all([
          getAllowedCategories(database),
          getAllowedLeads(database),
          getMeetingAnchorDate(database),
        ]);
      const payload = topicPayload(
        body.topic || {},
        profile,
        allowedCategories,
        allowedLeads,
        meetingAnchorDate,
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
      const [allowedCategories, allowedLeads, meetingAnchorDate] =
        await Promise.all([
          getAllowedCategories(database),
          getAllowedLeads(database),
          getMeetingAnchorDate(database),
        ]);
      const payload = topicPayload(
        body.topic || {},
        profile,
        allowedCategories,
        allowedLeads,
        meetingAnchorDate,
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

    if (body.action === 'delete_decision') {
      if (!Number.isSafeInteger(body.id) || Number(body.id) <= 0)
        throw new Error('Discussion ID is invalid.');
      const { data: existing, error: existingError } = await database
        .from('emt_topics')
        .select('id,bucket,decision')
        .eq('id', body.id)
        .maybeSingle();
      if (existingError) throw existingError;
      if (!existing) throw new Error('Discussion was not found.');
      if (!String(existing.decision || '').trim())
        throw new Error('This discussion does not have a recorded decision.');

      const movedToBacklog = existing.bucket === 'history';
      const decisionReset: Record<string, unknown> = {
        bucket: movedToBacklog ? 'backlog' : existing.bucket,
        decision: '',
        follow_up_owner: '',
        follow_up_action: '',
        due_date: null,
        decision_date: null,
        updated_by: profile.email,
        updated_at: new Date().toISOString(),
      };
      if (movedToBacklog) decisionReset.meeting_date = null;
      const { data, error } = await database
        .from('emt_topics')
        .update(decisionReset)
        .eq('id', body.id)
        .neq('decision', '')
        .select('*')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('The decision has already been deleted.');
      return json(origin, {
        topic: mapTopic(data as Record<string, unknown>),
        movedToBacklog,
      });
    }

    if (body.action === 'delete_topic') {
      if (!Number.isSafeInteger(body.id) || Number(body.id) <= 0)
        throw new Error('Discussion ID is invalid.');
      const { data, error } = await database
        .from('emt_topics')
        .delete()
        .eq('id', body.id)
        .select('id,title')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Discussion was not found.');
      return json(origin, {
        deletedTopicId: Number(data.id),
        deletedTopicTitle: String(data.title),
      });
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
        .from('emt_member_settings')
        .upsert(
          {
            member_email: profile.email,
            ...payload,
          },
          { onConflict: 'member_email' },
        )
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
    const status =
      error instanceof EmtHttpError
        ? error.status
        : /required|approved|issued|match|verify/i.test(message)
          ? 401
          : 400;
    return json(origin, { error: message }, status);
  }
});
