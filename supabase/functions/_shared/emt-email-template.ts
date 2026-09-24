export type ReminderKind =
  | 'agenda_preparation'
  | 'follow_up_due'
  | 'follow_up_overdue';

export type ReminderEmailInput = {
  kind: ReminderKind;
  recipientName: string;
  topicTitle: string;
  category: string;
  action: string;
  decision?: string;
  meetingDate?: string;
  dueDate?: string;
  trackerUrl: string;
  preferencesUrl: string;
};

export type RecipientTestEmailInput = {
  recipientName: string;
};

type ReminderCopy = {
  eyebrow: string;
  title: string;
  intro: string;
  dateLabel: string;
  buttonLabel: string;
  subjectPrefix: string;
};

const COPY: Record<ReminderKind, ReminderCopy> = {
  agenda_preparation: {
    eyebrow: 'Agenda preparation',
    title: 'A topic needs your input',
    intro: 'Please prepare the item below for the next Executive Team meeting.',
    dateLabel: 'Meeting date',
    buttonLabel: 'Open agenda item',
    subjectPrefix: 'Prepare for the next EMT meeting',
  },
  follow_up_due: {
    eyebrow: 'Follow-up reminder',
    title: 'An agreed action is coming due',
    intro: 'This is a reminder about an action assigned to you in EMT Tracker.',
    dateLabel: 'Due date',
    buttonLabel: 'Review action',
    subjectPrefix: 'EMT action due soon',
  },
  follow_up_overdue: {
    eyebrow: 'Overdue follow-up',
    title: 'An agreed action is overdue',
    intro:
      'Please review the action below and update its status in EMT Tracker.',
    dateLabel: 'Due date',
    buttonLabel: 'Update action',
    subjectPrefix: 'EMT action overdue',
  },
};

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeHttpUrl(value: string) {
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Email links must use HTTP or HTTPS.');
  }
  return escapeHtml(parsed.toString());
}

function subject(input: ReminderEmailInput, copy: ReminderCopy) {
  return `[EMT Tracker] ${copy.subjectPrefix}: ${input.topicTitle}`;
}

function plainText(input: ReminderEmailInput, copy: ReminderCopy) {
  const date =
    input.kind === 'agenda_preparation' ? input.meetingDate : input.dueDate;
  return [
    `Hi ${input.recipientName},`,
    '',
    copy.intro,
    '',
    `Topic: ${input.topicTitle}`,
    `Category: ${input.category}`,
    input.decision ? `Decision: ${input.decision}` : '',
    `Your action: ${input.action}`,
    date ? `${copy.dateLabel}: ${date}` : '',
    '',
    `Open EMT Tracker: ${input.trackerUrl}`,
    `Reminder settings: ${input.preferencesUrl}`,
    '',
    'Sent by EMT Tracker for the GMS Executive Team.',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

export function renderReminderEmail(input: ReminderEmailInput) {
  const copy = COPY[input.kind];
  const date =
    input.kind === 'agenda_preparation' ? input.meetingDate : input.dueDate;
  const logoUrl = safeHttpUrl(
    'https://spark.kmt.global/emt-tracker/assets/gms-logo-white.png',
  );
  const trackerUrl = safeHttpUrl(input.trackerUrl);
  const preferencesUrl = safeHttpUrl(input.preferencesUrl);
  const recipientName = escapeHtml(input.recipientName);
  const topicTitle = escapeHtml(input.topicTitle);
  const category = escapeHtml(input.category);
  const action = escapeHtml(input.action);
  const decision = input.decision ? escapeHtml(input.decision) : '';
  const dateValue = date ? escapeHtml(date) : 'Not set';

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(subject(input, copy))}</title>
  </head>
  <body style="margin:0;padding:0;background:#ffffff;color:#25282b;font-family:Arial,'Helvetica Neue',sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(copy.intro)} ${topicTitle}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#ffffff;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-collapse:separate;border-spacing:0;border-radius:18px;overflow:hidden;box-shadow:0 12px 32px rgba(37,40,43,.10);">
            <tr>
              <td style="background:#007fc8;padding:24px 30px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="left" valign="middle"><img src="${logoUrl}" width="132" alt="GMS 10 Years" style="display:block;width:132px;height:auto;border:0;"></td>
                    <td align="right" valign="middle" style="color:#ffffff;font-size:15px;font-weight:700;letter-spacing:-.01em;">EMT Tracker</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:34px 34px 14px;">
                <div style="color:#007fc8;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">${escapeHtml(copy.eyebrow)}</div>
                <h1 style="margin:10px 0 12px;color:#25282b;font-size:28px;line-height:1.18;letter-spacing:-.03em;">${escapeHtml(copy.title)}</h1>
                <p style="margin:0;color:#464546;font-size:15px;line-height:1.6;">Hi ${recipientName}, ${escapeHtml(copy.intro)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 34px 8px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#eaf7fd;border:1px solid #d8e0e4;border-radius:14px;">
                  <tr>
                    <td style="padding:22px 24px;">
                      <div style="display:inline-block;margin:0 0 9px;padding:5px 9px;border-radius:999px;background:#fff0ea;color:#8a351c;font-size:11px;font-weight:700;">${category}</div>
                      <h2 style="margin:0;color:#25282b;font-size:19px;line-height:1.35;letter-spacing:-.02em;">${topicTitle}</h2>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            ${decision ? `<tr><td style="padding:10px 34px 0;"><div style="padding:16px 18px;border-left:4px solid #009ae6;background:#f4f7f8;"><div style="margin:0 0 6px;color:#464546;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;">Decision</div><div style="color:#25282b;font-size:14px;line-height:1.55;">${decision}</div></div></td></tr>` : ''}
            <tr>
              <td style="padding:18px 34px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
                  <tr>
                    <td valign="top" style="padding:0 16px 16px 0;width:50%;">
                      <div style="margin:0 0 6px;color:#464546;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;">Your action</div>
                      <div style="color:#25282b;font-size:14px;font-weight:700;line-height:1.5;">${action}</div>
                    </td>
                    <td valign="top" style="padding:0 0 16px 16px;width:50%;border-left:1px solid #d8e0e4;">
                      <div style="margin:0 0 6px;color:#464546;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;">${escapeHtml(copy.dateLabel)}</div>
                      <div style="color:#25282b;font-size:14px;font-weight:700;line-height:1.5;">${dateValue}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 34px 34px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td bgcolor="#ff6632" style="border-radius:10px;"><a href="${trackerUrl}" style="display:inline-block;padding:13px 20px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">${escapeHtml(copy.buttonLabel)}</a></td></tr></table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 34px 24px;border-top:1px solid #d8e0e4;color:#687076;font-size:12px;line-height:1.55;">
                Sent by EMT Tracker for the GMS Executive Team.<br>
                <a href="${preferencesUrl}" style="color:#007fc8;text-decoration:underline;">Manage reminder settings</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return {
    subject: subject(input, copy),
    html,
    text: plainText(input, copy),
  };
}

export function renderRecipientTestEmail(input: RecipientTestEmailInput) {
  const subjectLine = "[TEST] [EMT Tracker] Coco's email delivery test";
  const recipientName = escapeHtml(input.recipientName);
  const logoUrl = safeHttpUrl(
    'https://spark.kmt.global/emt-tracker/assets/gms-logo-white.png',
  );
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(subjectLine)}</title>
  </head>
  <body style="margin:0;padding:0;background:#ffffff;color:#25282b;font-family:Arial,'Helvetica Neue',sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Coco is testing EMT Tracker email delivery. No action is required.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#ffffff;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #d8e0e4;border-collapse:separate;border-spacing:0;border-radius:14px;overflow:hidden;box-shadow:0 14px 38px rgba(37,40,43,.08);">
            <tr><td style="height:4px;font-size:0;line-height:0;background:#ff6632;">&nbsp;</td></tr>
            <tr>
              <td style="padding:20px 30px;background:#007fc8;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="left" valign="middle"><img src="${logoUrl}" width="126" alt="GMS 10 Years" style="display:block;width:126px;height:auto;border:0;"></td>
                    <td align="right" valign="middle" style="color:#ffffff;font-size:15px;font-weight:700;line-height:1.2;">EMT Tracker</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:38px 42px 18px;">
                <h1 style="margin:0 0 14px;color:#25282b;font-size:30px;font-weight:700;line-height:1.16;letter-spacing:-.025em;">EMT Tracker email test</h1>
                <p style="margin:0 0 10px;color:#464546;font-size:15px;line-height:1.6;">Hi ${recipientName},</p>
                <p style="margin:0;color:#464546;font-size:15px;line-height:1.6;">Coco is running a test of the EMT Tracker reminder system to confirm that emails can be delivered to your GMS inbox.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 42px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border:1px solid #d8e0e4;border-collapse:separate;border-spacing:0;border-radius:12px;background:#eaf7fd;">
                  <tr>
                    <td style="padding:24px;">
                      <p style="margin:0 0 7px;color:#007fc8;font-size:12px;font-weight:700;line-height:1.3;">No action required</p>
                      <p style="margin:0;color:#25282b;font-size:16px;font-weight:700;line-height:1.45;">If you can see this message, Coco's email delivery test has worked as expected.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr><td style="padding:22px 42px 38px;color:#464546;font-size:14px;line-height:1.6;"><p style="margin:0;">No response is needed. Thank you.</p></td></tr>
            <tr>
              <td style="padding:20px 42px 24px;border-top:1px solid #d8e0e4;color:#617086;background:#ffffff;font-size:11px;line-height:1.55;">
                <p style="margin:0 0 5px;">Sent by GMS EMT Tracker from <strong style="color:#464546;">insights@gms.global</strong>.</p>
                <p style="margin:0;">This is a system test only. No action is required.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  const text = [
    `Hi ${input.recipientName},`,
    '',
    'Coco is running a test of the EMT Tracker reminder system to confirm that emails can be delivered to your GMS inbox.',
    '',
    "If you can see this message, Coco's email delivery test has worked as expected.",
    '',
    'No response is needed. Thank you.',
    '',
    'Sent by GMS EMT Tracker from insights@gms.global.',
    'This is a system test only. No action is required.',
  ].join('\n');
  return { subject: subjectLine, html, text };
}
