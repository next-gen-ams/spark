import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.117.1';
import {
  renderReminderEmail,
  type ReminderEmailInput,
  type ReminderKind,
} from '../_shared/emt-email-template.ts';

const WORKSPACE_ID = 'gms-emt';
const MELBOURNE_TIME_ZONE = 'Australia/Melbourne';
const TRACKER_URL = 'https://spark.kmt.global/emt-tracker/';
const PREFERENCES_URL = `${TRACKER_URL}?view=reminders`;
const DEFAULT_SENDER = 'insights@gms.global';

type SettingsRow = {
  reminders_on: boolean;
  agenda_reminder_timing: string;
  followup_reminder_timing: string;
  overdue_reminders_on: boolean;
  business_days_only: boolean;
  meeting_anchor_date: string;
};

type MemberRow = {
  display_name: string;
  email: string;
  active: boolean;
};

type TopicRow = {
  id: number;
  bucket: 'agenda' | 'backlog' | 'history';
  title: string;
  category: string;
  lead: string;
  prep_action: string;
  decision: string;
  follow_up_owner: string;
  follow_up_action: string;
  due_date: string | null;
  remind_lead: boolean;
  remind_followup: boolean;
};

type Candidate = {
  eventKey: string;
  topicId: number;
  kind: ReminderKind;
  recipientName: string;
  recipientEmail: string;
  scheduledFor: string;
  input: ReminderEmailInput;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function localIsoDate(now: Date) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: MELBOURNE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function parseIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Date must use YYYY-MM-DD.');
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error('Date is invalid.');
  return date;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(value: string, amount: number) {
  const date = parseIsoDate(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return isoDate(date);
}

function isWeekend(value: string) {
  const day = parseIsoDate(value).getUTCDay();
  return day === 0 || day === 6;
}

function subtractBusinessDays(value: string, amount: number) {
  let result = value;
  let remaining = amount;
  while (remaining > 0) {
    result = addDays(result, -1);
    if (!isWeekend(result)) remaining -= 1;
  }
  return result;
}

function timingDays(value: string) {
  if (value === 'On the due date') return 0;
  const match = value.match(/^(\d+) business days? before/i);
  if (!match) throw new Error(`Unsupported reminder timing: ${value}`);
  return Number(match[1]);
}

function nextMeetingDate(anchor: string, today: string) {
  let meeting = anchor;
  if (meeting >= today) return meeting;
  const elapsed = Math.floor(
    (parseIsoDate(today).getTime() - parseIsoDate(anchor).getTime()) /
      86_400_000,
  );
  meeting = addDays(anchor, Math.floor(elapsed / 14) * 14);
  while (meeting < today) meeting = addDays(meeting, 14);
  return meeting;
}

function formatLongDate(value: string) {
  return new Intl.DateTimeFormat('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parseIsoDate(value));
}

function safeMessage(value: unknown) {
  return value instanceof Error ? value.message : 'Unknown reminder delivery error.';
}

function constantTimeEqual(left: string, right: string) {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  if (leftBytes.length !== rightBytes.length) return false;
  let result = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    result |= leftBytes[index] ^ rightBytes[index];
  }
  return result === 0;
}

function assertJobAuthorization(request: Request) {
  const expected = Deno.env.get('EMT_REMINDER_JOB_SECRET') || '';
  const provided = request.headers.get('x-emt-reminder-key') || '';
  if (!expected) throw new Error('Reminder job authorization is not configured.');
  if (!constantTimeEqual(provided, expected)) throw new Error('Reminder job authorization failed.');
}

async function graphAccessToken() {
  const tenantId = Deno.env.get('MICROSOFT_TENANT_ID') || '';
  const clientId = Deno.env.get('MICROSOFT_CLIENT_ID') || '';
  const clientSecret = Deno.env.get('MICROSOFT_CLIENT_SECRET') || '';
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Microsoft Graph sender credentials are not configured.');
  }
  const form = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });
  const response = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    },
  );
  const payload = (await response.json()) as {
    access_token?: string;
    error_description?: string;
  };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || 'Microsoft Graph token request failed.');
  }
  return payload.access_token;
}

async function sendGraphMail(candidate: Candidate, accessToken: string) {
  const sender = (Deno.env.get('EMT_REMINDER_SENDER') || DEFAULT_SENDER).toLowerCase();
  if (sender !== DEFAULT_SENDER) throw new Error('The configured sender is not approved for EMT Tracker.');
  const email = renderReminderEmail(candidate.input);
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject: email.subject,
          body: { contentType: 'HTML', content: email.html },
          toRecipients: [
            { emailAddress: { address: candidate.recipientEmail } },
          ],
        },
        saveToSentItems: true,
      }),
    },
  );
  if (response.status !== 202) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Microsoft Graph sendMail failed (${response.status}): ${detail}`);
  }
  return response.headers.get('request-id') || response.headers.get('client-request-id');
}

function buildCandidates(
  today: string,
  settings: SettingsRow,
  members: MemberRow[],
  topics: TopicRow[],
) {
  const memberByName = new Map(
    members
      .filter((member) => member.active && member.email)
      .map((member) => [member.display_name, member]),
  );
  const meetingDate = nextMeetingDate(settings.meeting_anchor_date, today);
  const agendaDate = subtractBusinessDays(
    meetingDate,
    timingDays(settings.agenda_reminder_timing),
  );
  const candidates: Candidate[] = [];

  for (const topic of topics) {
    if (
      topic.bucket === 'agenda' &&
      topic.remind_lead &&
      agendaDate === today
    ) {
      const member = memberByName.get(topic.lead);
      if (member) {
        candidates.push({
          eventKey: `agenda:${topic.id}:${meetingDate}:${member.email}`,
          topicId: topic.id,
          kind: 'agenda_preparation',
          recipientName: member.display_name,
          recipientEmail: member.email,
          scheduledFor: today,
          input: {
            kind: 'agenda_preparation',
            recipientName: member.display_name,
            topicTitle: topic.title,
            category: topic.category,
            action: topic.prep_action || 'Review the topic and prepare the input needed for discussion.',
            meetingDate: formatLongDate(meetingDate),
            trackerUrl: TRACKER_URL,
            preferencesUrl: PREFERENCES_URL,
          },
        });
      }
    }

    if (!topic.remind_followup || !topic.due_date || !topic.follow_up_owner) continue;
    const member = memberByName.get(topic.follow_up_owner);
    if (!member) continue;
    const dueReminderDate = subtractBusinessDays(
      topic.due_date,
      timingDays(settings.followup_reminder_timing),
    );
    const baseInput = {
      recipientName: member.display_name,
      topicTitle: topic.title,
      category: topic.category,
      action: topic.follow_up_action || 'Review and update the agreed follow-up action.',
      decision: topic.decision,
      dueDate: formatLongDate(topic.due_date),
      trackerUrl: TRACKER_URL,
      preferencesUrl: PREFERENCES_URL,
    };
    if (dueReminderDate === today) {
      candidates.push({
        eventKey: `follow-up:${topic.id}:${topic.due_date}:${member.email}`,
        topicId: topic.id,
        kind: 'follow_up_due',
        recipientName: member.display_name,
        recipientEmail: member.email,
        scheduledFor: today,
        input: { kind: 'follow_up_due', ...baseInput },
      });
    }
    if (
      settings.overdue_reminders_on &&
      topic.due_date < today &&
      (!settings.business_days_only || !isWeekend(today))
    ) {
      candidates.push({
        eventKey: `overdue:${topic.id}:${today}:${member.email}`,
        topicId: topic.id,
        kind: 'follow_up_overdue',
        recipientName: member.display_name,
        recipientEmail: member.email,
        scheduledFor: today,
        input: { kind: 'follow_up_overdue', ...baseInput },
      });
    }
  }
  return candidates;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  try {
    assertJobAuthorization(request);
    const body = (await request.json().catch(() => ({}))) as {
      mode?: 'dry_run' | 'send';
      date?: string;
    };
    const mode = body.mode || 'dry_run';
    if (mode !== 'dry_run' && mode !== 'send') throw new Error('Mode must be dry_run or send.');
    const today = body.date || localIsoDate(new Date());
    parseIsoDate(today);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Database service is not configured.');
    const database = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const [settingsResult, membersResult, topicsResult] = await Promise.all([
      database.from('emt_settings').select('*').eq('workspace_id', WORKSPACE_ID).single(),
      database.from('emt_members').select('display_name,email,active').eq('active', true),
      database.from('emt_topics').select('id,bucket,title,category,lead,prep_action,decision,follow_up_owner,follow_up_action,due_date,remind_lead,remind_followup'),
    ]);
    if (settingsResult.error) throw settingsResult.error;
    if (membersResult.error) throw membersResult.error;
    if (topicsResult.error) throw topicsResult.error;
    const settings = settingsResult.data as SettingsRow;
    if (!settings.reminders_on) return json({ mode, date: today, status: 'paused', candidates: [] });
    const candidates = buildCandidates(
      today,
      settings,
      (membersResult.data || []) as MemberRow[],
      (topicsResult.data || []) as TopicRow[],
    );
    if (mode === 'dry_run') {
      return json({
        mode,
        date: today,
        senderConfigured: Boolean(Deno.env.get('MICROSOFT_CLIENT_SECRET')),
        candidates: candidates.map((candidate) => ({
          eventKey: candidate.eventKey,
          topicId: candidate.topicId,
          kind: candidate.kind,
          recipientName: candidate.recipientName,
          recipientEmail: candidate.recipientEmail,
          scheduledFor: candidate.scheduledFor,
          subject: renderReminderEmail(candidate.input).subject,
        })),
      });
    }

    const accessToken = await graphAccessToken();
    const deliveries: Array<Record<string, unknown>> = [];
    for (const candidate of candidates) {
      const email = renderReminderEmail(candidate.input);
      const { data: prepared, error: prepareError } = await database
        .from('emt_reminder_deliveries')
        .insert({
          event_key: candidate.eventKey,
          workspace_id: WORKSPACE_ID,
          topic_id: candidate.topicId,
          reminder_type: candidate.kind,
          recipient_name: candidate.recipientName,
          recipient_email: candidate.recipientEmail,
          subject: email.subject,
          scheduled_for: candidate.scheduledFor,
          status: 'prepared',
        })
        .select('id')
        .maybeSingle();
      if (prepareError?.code === '23505') {
        deliveries.push({ eventKey: candidate.eventKey, status: 'duplicate_skipped' });
        continue;
      }
      if (prepareError || !prepared) throw prepareError || new Error('Delivery record was not created.');
      try {
        const graphRequestId = await sendGraphMail(candidate, accessToken);
        const { error: updateError } = await database
          .from('emt_reminder_deliveries')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            graph_request_id: graphRequestId,
            attempt_count: 1,
          })
          .eq('id', prepared.id);
        if (updateError) throw updateError;
        deliveries.push({ eventKey: candidate.eventKey, status: 'sent' });
      } catch (error) {
        await database
          .from('emt_reminder_deliveries')
          .update({ status: 'failed', error_message: safeMessage(error).slice(0, 1000), attempt_count: 1 })
          .eq('id', prepared.id);
        deliveries.push({ eventKey: candidate.eventKey, status: 'failed', error: safeMessage(error) });
      }
    }
    return json({ mode, date: today, deliveries });
  } catch (error) {
    const message = safeMessage(error);
    const status = /authorization/i.test(message) ? 401 : 400;
    return json({ error: message }, status);
  }
});
