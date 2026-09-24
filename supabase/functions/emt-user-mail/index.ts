import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.117.1';
import {
  authenticateEmtMember,
  bearerToken,
  EMT_ALLOWED_ORIGINS,
  emtCorsHeaders,
  emtErrorResponse,
  EmtHttpError,
  emtJson,
} from '../_shared/emt-member-auth.ts';
import { renderMemberTopicEmail } from '../_shared/emt-email-template.ts';

const TRACKER_URL = 'https://spark.kmt.global/emt-tracker/';
const MAX_RECIPIENTS = 3;
const RATE_LIMIT_WINDOW_MINUTES = 15;
const RATE_LIMIT_SENDS = 5;

type RequestBody = {
  action?: unknown;
  topicId?: unknown;
  recipientEmails?: unknown;
  requestId?: unknown;
};

type MemberRow = {
  display_name: string;
  email: string;
};

type TopicRow = {
  id: number;
  title: string;
  category: string;
  note: string;
  prep_action: string;
  decision: string;
  follow_up_action: string;
};

function parseRequestId(value: unknown) {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new EmtHttpError(
      'A valid preview request ID is required.',
      422,
      'invalid_request_id',
    );
  }
  return value.toLowerCase();
}

function parseTopicId(value: unknown) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0)
    throw new EmtHttpError('Select a valid EMT topic.', 422, 'invalid_topic');
  return id;
}

function parseRecipientEmails(value: unknown) {
  if (!Array.isArray(value))
    throw new EmtHttpError(
      'Select at least one EMT recipient.',
      422,
      'invalid_recipients',
    );
  const emails = [
    ...new Set(
      value
        .filter((email): email is string => typeof email === 'string')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  if (emails.length < 1 || emails.length > MAX_RECIPIENTS)
    throw new EmtHttpError(
      `Select between 1 and ${MAX_RECIPIENTS} EMT recipients.`,
      422,
      'invalid_recipient_count',
    );
  if (emails.some((email) => email.length > 254 || !email.includes('@')))
    throw new EmtHttpError(
      'One or more recipient addresses are invalid.',
      422,
      'invalid_recipients',
    );
  return emails;
}

async function requestBody(request: Request) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 16_384)
    throw new EmtHttpError(
      'The request is too large.',
      413,
      'request_too_large',
    );
  try {
    return (await request.json()) as RequestBody;
  } catch {
    throw new EmtHttpError(
      'The request body is not valid JSON.',
      400,
      'invalid_json',
    );
  }
}

function topicAction(topic: TopicRow) {
  return (
    topic.follow_up_action ||
    topic.prep_action ||
    topic.decision ||
    topic.note ||
    'Review this topic before the next Executive Team discussion.'
  );
}

function renderFor(
  sender: { displayName: string; email: string },
  recipientName: string,
  topic: TopicRow,
) {
  return renderMemberTopicEmail({
    senderName: sender.displayName,
    senderEmail: sender.email,
    recipientName,
    topicTitle: topic.title,
    category: topic.category,
    action: topicAction(topic),
    trackerUrl: TRACKER_URL,
  });
}

async function sendGraphMail(
  token: string,
  recipients: MemberRow[],
  email: ReturnType<typeof renderMemberTopicEmail>,
) {
  const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        subject: email.subject,
        body: { contentType: 'HTML', content: email.html },
        toRecipients: recipients.map((recipient) => ({
          emailAddress: { address: recipient.email.toLowerCase() },
        })),
      },
      saveToSentItems: true,
    }),
  });
  if (response.status !== 202) {
    const detail = (await response.text()).slice(0, 500);
    console.error('Microsoft Graph delegated send failed', {
      status: response.status,
      detail,
    });
    throw new EmtHttpError(
      'Microsoft did not accept this email. Reconnect mail permission and try again.',
      response.status === 401 || response.status === 403 ? 403 : 502,
      'graph_send_failed',
    );
  }
  return (
    response.headers.get('request-id') ||
    response.headers.get('client-request-id') ||
    ''
  );
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get('origin') || '';
  if (!EMT_ALLOWED_ORIGINS.has(origin))
    return new Response('Origin not allowed', { status: 403 });
  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: emtCorsHeaders(origin) });
  if (request.method !== 'POST')
    return emtJson(
      origin,
      { error: { code: 'method_not_allowed', message: 'Method not allowed.' } },
      405,
    );

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey)
      throw new Error('Database service is not configured.');
    const database = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const profile = await authenticateEmtMember(request, database);
    const body = await requestBody(request);
    if (body.action !== 'preview' && body.action !== 'send')
      throw new EmtHttpError(
        'Action must be preview or send.',
        400,
        'unsupported_action',
      );
    const topicId = parseTopicId(body.topicId);
    const recipientEmails = parseRecipientEmails(body.recipientEmails);

    const [topicResult, membersResult] = await Promise.all([
      database
        .from('emt_topics')
        .select('id,title,category,note,prep_action,decision,follow_up_action')
        .eq('id', topicId)
        .maybeSingle(),
      database
        .from('emt_members')
        .select('display_name,email')
        .eq('active', true)
        .in('email', recipientEmails),
    ]);
    if (topicResult.error) throw topicResult.error;
    if (!topicResult.data)
      throw new EmtHttpError('Topic not found.', 404, 'topic_not_found');
    if (membersResult.error) throw membersResult.error;
    const recipients = (membersResult.data || []) as MemberRow[];
    if (recipients.length !== recipientEmails.length)
      throw new EmtHttpError(
        'Recipients must be active EMT members.',
        403,
        'recipient_not_allowed',
      );
    recipients.sort(
      (left, right) =>
        recipientEmails.indexOf(left.email.toLowerCase()) -
        recipientEmails.indexOf(right.email.toLowerCase()),
    );
    const topic = topicResult.data as TopicRow;
    const recipientName =
      recipients.length === 1 ? recipients[0].display_name : 'EMT team';
    const email = renderFor(profile, recipientName, topic);

    if (body.action === 'preview') {
      return emtJson(origin, {
        data: {
          requestId: crypto.randomUUID(),
          sender: profile,
          recipients: recipients.map((member) => ({
            displayName: member.display_name,
            email: member.email.toLowerCase(),
          })),
          subject: email.subject,
          html: email.html,
          text: email.text,
        },
      });
    }

    const requestId = parseRequestId(body.requestId);
    const windowStart = new Date(
      Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60_000,
    ).toISOString();
    const { count, error: rateError } = await database
      .from('emt_member_mail_deliveries')
      .select('id', { count: 'exact', head: true })
      .eq('sender_email', profile.email)
      .in('status', ['pending', 'sent'])
      .gte('created_at', windowStart);
    if (rateError) throw rateError;
    if ((count || 0) >= RATE_LIMIT_SENDS)
      throw new EmtHttpError(
        'Email send limit reached. Try again in 15 minutes.',
        429,
        'rate_limit_exceeded',
      );

    const { data: audit, error: auditError } = await database
      .from('emt_member_mail_deliveries')
      .insert({
        request_id: requestId,
        sender_email: profile.email,
        recipient_emails: recipientEmails,
        topic_id: topicId,
        subject: email.subject,
        status: 'pending',
      })
      .select('id')
      .single();
    if (auditError?.code === '23505') {
      const { data: existing, error } = await database
        .from('emt_member_mail_deliveries')
        .select('status')
        .eq('request_id', requestId)
        .single();
      if (error) throw error;
      if (existing.status === 'sent')
        return emtJson(
          origin,
          { data: { accepted: true, alreadySent: true, requestId } },
          202,
        );
      throw new EmtHttpError(
        'This preview has already been used. Create a fresh preview.',
        409,
        'request_already_used',
      );
    }
    if (auditError) throw auditError;

    const token = bearerToken(request);
    try {
      const graphRequestId = await sendGraphMail(token, recipients, email);
      const { error: updateError } = await database
        .from('emt_member_mail_deliveries')
        .update({
          status: 'sent',
          graph_request_id: graphRequestId,
          sent_at: new Date().toISOString(),
        })
        .eq('id', audit.id);
      if (updateError) {
        console.error('EMT mail audit update failed', {
          auditId: audit.id,
          message: updateError.message,
        });
      }
      return emtJson(
        origin,
        {
          data: {
            accepted: true,
            requestId,
            recipientCount: recipients.length,
          },
        },
        202,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Microsoft send failed.';
      await database
        .from('emt_member_mail_deliveries')
        .update({ status: 'failed', error_message: message.slice(0, 500) })
        .eq('id', audit.id);
      throw error;
    }
  } catch (error) {
    return emtErrorResponse(origin, error);
  }
});
