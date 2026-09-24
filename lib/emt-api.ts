import { getMicrosoftAccessToken } from '@/lib/microsoft-auth';

const EMT_API_URL =
  'https://agpggomwormexgjzbjtv.supabase.co/functions/v1/emt-workspace';

export type WorkspaceTopic = {
  id: number;
  bucket: 'agenda' | 'backlog' | 'history';
  title: string;
  category: string;
  status: 'Scheduled' | 'Needs lead' | 'Needs input';
  lead: string;
  leadInitials: string;
  time: string;
  note: string;
  reminder: string;
  decision: string;
  followUpOwner: string;
  dueDate: string;
  followUpAction: string;
  prepAction: string;
  decisionDate?: string;
  decisionDateIso?: string;
  source?: 'Agenda';
  remindLead: boolean;
  remindFollowup: boolean;
};

export type WorkspaceSettings = {
  remindersOn: boolean;
  agendaReminderTiming: string;
  followupReminderTiming: string;
  overdueRemindersOn: boolean;
  businessDaysOnly: boolean;
};

type WorkspaceResponse = {
  topics: WorkspaceTopic[];
  settings: WorkspaceSettings;
};

async function request<T>(method: 'GET' | 'POST', body?: unknown) {
  const accessToken = await getMicrosoftAccessToken();
  const response = await fetch(EMT_API_URL, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };
  if (!response.ok)
    throw new Error(
      result.error || `EMT workspace request failed (${response.status}).`,
    );
  return result;
}

export function loadEmtWorkspace() {
  return request<WorkspaceResponse>('GET');
}

export async function createEmtTopic(topic: Omit<WorkspaceTopic, 'id'>) {
  const result = await request<{ topic: WorkspaceTopic }>('POST', {
    action: 'create_topic',
    topic,
  });
  return result.topic;
}

export async function saveEmtTopic(topic: WorkspaceTopic) {
  const result = await request<{ topic: WorkspaceTopic }>('POST', {
    action: 'save_topic',
    topic,
  });
  return result.topic;
}

export async function saveEmtSettings(settings: WorkspaceSettings) {
  const result = await request<{ settings: WorkspaceSettings }>('POST', {
    action: 'save_settings',
    settings,
  });
  return result.settings;
}
