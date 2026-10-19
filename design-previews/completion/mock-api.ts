import type {
  WorkspaceTopic,
  WorkspaceCategory,
  WorkspaceMember,
  WorkspaceSettings,
} from '../../lib/emt-api';
import { profile } from './mock-auth';
export type {
  WorkspaceTopic,
  WorkspaceCategory,
  WorkspaceMember,
  WorkspaceSettings,
};

const STORAGE = 'emt-completion-visual-preview-v1';
const examples: WorkspaceTopic[] = [
  {
    id: 900001,
    bucket: 'history',
    title: 'Update the team onboarding checklist',
    category: 'People & culture',
    status: 'Scheduled',
    lead: 'Demo Owner',
    leadInitials: 'DO',
    time: '10 min',
    note: 'Sample record for reviewing the completion interaction.',
    prepAction: '',
    decision: 'Use one shared onboarding checklist for all new team members.',
    followUpOwner: 'Demo Owner',
    followUpAction: 'Publish the updated checklist and share it with the team.',
    dueDate: '2026-10-30',
    decisionDateIso: '2026-10-19',
    source: 'Agenda',
  },
  {
    id: 900002,
    bucket: 'history',
    title: 'Confirm the team leave calendar',
    category: 'People & culture',
    status: 'Scheduled',
    lead: 'Demo Owner',
    leadInitials: 'DO',
    time: '10 min',
    note: 'Sample completed record.',
    prepAction: '',
    decision: 'Use a shared calendar to confirm leave coverage.',
    followUpOwner: 'Demo Owner',
    followUpAction: 'Share the leave coverage calendar with the team.',
    dueDate: '2026-10-23',
    decisionDateIso: '2026-10-19',
    completedAt: '2026-10-19T00:00:00Z',
    completedBy: 'demo@example.test',
    source: 'Agenda',
  },
];
examples.push(
  {
    ...examples[0],
    id: 900003,
    bucket: 'backlog',
    title: 'Review the onboarding rollout',
  },
  {
    ...examples[1],
    id: 900004,
    bucket: 'backlog',
    title: 'Confirm leave coverage owners',
  },
  {
    ...examples[0],
    id: 900005,
    bucket: 'agenda',
    title: 'Share the weekly operations update',
    meetingDate: '2026-10-19',
  },
);
let topics = structuredClone(examples);
let settings: WorkspaceSettings = {
  remindersOn: true,
  agendaReminderTiming: '2 business days before',
  followupReminderTiming: '1 business day before',
  overdueRemindersOn: true,
  businessDaysOnly: true,
};
const categories: WorkspaceCategory[] = [
  'People & culture',
  'Operations',
  'Governance',
  'Finance',
].map((name, i) => ({
  id: i + 1,
  name,
  sortOrder: i,
  active: true,
  system: false,
  usageCount: i === 0 ? 2 : 0,
}));
const wait = () => new Promise((resolve) => setTimeout(resolve, 650));
function persist() {
  localStorage.setItem(STORAGE, JSON.stringify(topics));
}
export async function loadEmtWorkspace() {
  try {
    const saved = localStorage.getItem(STORAGE);
    if (saved) topics = JSON.parse(saved);
  } catch {
    topics = structuredClone(examples);
  }
  return {
    profile,
    topics: structuredClone(topics),
    settings,
    schedule: { meetingAnchorDate: '2026-09-14' },
    categories,
    members: [{ displayName: profile.displayName, email: profile.email }],
  };
}
export async function setEmtCompletion(id: number, complete: boolean) {
  await wait();
  const topic = topics.find((item) => item.id === id);
  if (!topic?.decision || !topic.followUpOwner)
    throw new Error('Save a decision and assign an owner first.');
  topic.completedAt = complete
    ? topic.completedAt || new Date().toISOString()
    : undefined;
  topic.completedBy = complete ? profile.email : undefined;
  persist();
  return structuredClone(topic);
}
export async function saveEmtTopic(updated: WorkspaceTopic) {
  await wait();
  const old = topics.find((item) => item.id === updated.id);
  const saved = { ...updated };
  if (
    old &&
    ['decision', 'followUpOwner', 'followUpAction', 'dueDate'].some(
      (key) =>
        old[key as keyof WorkspaceTopic] !==
        updated[key as keyof WorkspaceTopic],
    )
  ) {
    saved.completedAt = undefined;
    saved.completedBy = undefined;
  }
  topics = topics.map((item) => (item.id === saved.id ? saved : item));
  persist();
  return structuredClone(saved);
}
export async function createEmtTopic(input: Omit<WorkspaceTopic, 'id'>) {
  const topic = { ...input, id: Date.now() };
  topics.push(topic);
  persist();
  return topic;
}
export async function deleteEmtTopic(id: number) {
  const topic = topics.find((item) => item.id === id);
  topics = topics.filter((item) => item.id !== id);
  persist();
  return { deletedTopicId: id, deletedTopicTitle: topic?.title || '' };
}
export async function deleteEmtDecision(id: number) {
  const topic = topics.find((item) => item.id === id)!;
  const updated = await saveEmtTopic({
    ...topic,
    bucket: 'backlog',
    decision: '',
    followUpAction: '',
    followUpOwner: '',
    dueDate: '',
    completedAt: undefined,
    completedBy: undefined,
  });
  return { topic: updated, movedToBacklog: true };
}
export async function saveEmtSettings(next: WorkspaceSettings) {
  settings = next;
  return settings;
}
export async function createEmtCategory(name: string) {
  const category = {
    id: Date.now(),
    name,
    sortOrder: categories.length,
    active: true,
    system: false,
    usageCount: 0,
  };
  categories.push(category);
  return category;
}
export async function renameEmtCategory(id: number, name: string) {
  const category = categories.find((item) => item.id === id)!;
  category.name = name;
  return category;
}
export async function deleteEmtCategory(id: number) {
  const category = categories.find((item) => item.id === id)!;
  category.active = false;
  return { deletedCategory: category.name, reassignedCount: 0 };
}
