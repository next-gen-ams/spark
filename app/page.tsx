'use client';

import * as React from 'react';
import Image from 'next/image';
import {
  Bell, CalendarDays, Check, CheckCircle2, ChevronRight, CircleAlert,
  ClipboardCheck, Clock3, FileText, FileUp, LayoutList, LogIn, Mail, Menu,
  MessageSquareText, Plus, Search, Sparkles, UploadCloud, UserRound, Users, WandSparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarProvider,
} from '@/components/ui/sidebar';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Toaster, toast } from '@/components/ui/toast';

type TopicStatus = 'Scheduled' | 'Needs lead' | 'Needs input';
type WorkspaceView = 'meeting' | 'backlog' | 'summaries' | 'decisions' | 'people' | 'reminders';
type Topic = {
  id: number; title: string; category: string; status: TopicStatus;
  lead: string; leadInitials: string; time: string; note: string; reminder: string;
  decision: string; followUpOwner: string; dueDate: string; followUpAction: string; prepAction: string;
  decisionDate?: string; decisionDateIso?: string; source?: 'Agenda' | 'AI summary';
  remindLead: boolean; remindFollowup: boolean;
};

type OwnershipItem = {
  id: number; owner: string; initials: string;
  kind: 'Follow-up' | 'Meeting preparation' | 'Unassigned';
  topic: Topic; action: string; due: string;
};

type ExtractedDecision = {
  id: number; selected: boolean; title: string; category: string;
  decision: string; owner: string; action: string; dueDate: string;
};

type WebMCPContext = {
  registerTool: (
    tool: {
      name: string; title: string; description: string;
      inputSchema: Record<string, unknown>;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => Promise<Record<string, unknown>>;
    },
    options?: { signal?: AbortSignal },
  ) => void | Promise<void>;
};

const EMT_MEMBERS = ['Lisa Xu', 'George Pesutto', 'Coco Hu', 'Brenda Cugley'];
const TOPIC_CATEGORIES = ['Operations', 'People & culture', 'Governance', 'Finance'];

const initialTopics: Topic[] = [
  { id: 1, title: 'Confirm Q4 all-hands owners and format', category: 'People & culture', status: 'Scheduled', lead: 'Lisa Xu', leadInitials: 'LX', time: '10 min', note: 'Agree the host, business updates and questions format before the October invitation is drafted.', reminder: '2 business days before meeting', prepAction: 'Bring the proposed host and three business update owners.', decision: 'Run a 45-minute all-hands with one host, three business updates and a moderated team Q&A.', followUpOwner: 'Lisa Xu', followUpAction: 'Draft the October all-hands invitation and confirm the three business update owners.', dueDate: '2026-09-22', decisionDate: '3 September 2026', decisionDateIso: '2026-09-03', source: 'Agenda', remindLead: false, remindFollowup: false },
  { id: 2, title: 'Review contract signing authority', category: 'Governance', status: 'Needs input', lead: 'George Pesutto', leadInitials: 'GP', time: '15 min', note: 'Review current thresholds and decide whether the operating policy needs a 2026 update.', reminder: '1 business day before meeting', prepAction: 'Bring the current signing thresholds and flagged policy gaps to the meeting.', decision: '', followUpOwner: '', followUpAction: '', dueDate: '', source: 'Agenda', remindLead: false, remindFollowup: false },
  { id: 3, title: 'Executive offsite planning approach', category: 'Operations', status: 'Needs input', lead: 'Coco Hu', leadInitials: 'CH', time: '8 min', note: 'Agree who will return with timing, location options and a proposed working agenda.', reminder: '2 business days before meeting', prepAction: 'Bring timing, location options and a draft working agenda.', decision: '', followUpOwner: '', followUpAction: '', dueDate: '', source: 'Agenda', remindLead: false, remindFollowup: false },
  { id: 4, title: 'Approve shared leave coverage process', category: 'Operations', status: 'Scheduled', lead: 'Brenda Cugley', leadInitials: 'BC', time: '7 min', note: 'Confirm the minimum handover information and who owns the shared coverage calendar.', reminder: '2 business days before meeting', prepAction: 'Bring the draft handover template for a final check.', decision: 'Use one shared coverage calendar and require a named backup plus a short handover note for leave longer than two days.', followUpOwner: 'Brenda Cugley', followUpAction: 'Set up the shared coverage calendar and circulate the handover template.', dueDate: '2026-09-18', decisionDate: '20 August 2026', decisionDateIso: '2026-08-20', source: 'Agenda', remindLead: false, remindFollowup: false },
];

const initialBacklog: Topic[] = [
  { id: 101, title: 'Clarify quarterly recognition budget', category: 'Finance', status: 'Needs input', lead: 'Lisa Xu', leadInitials: 'LX', time: '10 min', note: 'Confirm the budget information needed before this moves to a meeting.', reminder: 'Not scheduled', prepAction: 'Identify the budget input needed.', decision: '', followUpOwner: '', followUpAction: '', dueDate: '', source: 'Agenda', remindLead: false, remindFollowup: false },
  { id: 102, title: 'Review after-hours office access policy', category: 'Operations', status: 'Scheduled', lead: 'Coco Hu', leadInitials: 'CH', time: '10 min', note: 'Review whether the current process still matches the team’s operating pattern.', reminder: 'Not scheduled', prepAction: 'Bring the current access process and recent exceptions.', decision: '', followUpOwner: '', followUpAction: '', dueDate: '', source: 'Agenda', remindLead: false, remindFollowup: false },
];

const SAMPLE_SUMMARY = `Executive meeting summary — 28 September 2026

Decision: We agreed to update the contract signing authority policy before the end of October. George Pesutto will prepare the revised thresholds for review.

Decision: The executive offsite will be held in November and Coco Hu will return with two venue options and a draft agenda.

Action: Brenda Cugley will set up the shared leave coverage calendar by 9 October.`;

function StatusBadge({ status }: { status: TopicStatus }) {
  const Icon = status === 'Scheduled' ? CalendarDays : CircleAlert;
  return <Badge className={`status-badge status-${status.toLowerCase().replace(' ', '-')}`}><Icon aria-hidden="true" />{status}</Badge>;
}

function formatDueDate(value: string) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}

function formatDecisionDate(value: string | undefined, fallback: string | undefined) {
  if (!value) return fallback || 'Date not set';
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}

function normalizeSearch(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s&]/g, ' ');
}

function editDistance(left: string, right: string) {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let previous = row[0];
    row[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const current = row[rightIndex];
      row[rightIndex] = Math.min(
        row[rightIndex] + 1,
        row[rightIndex - 1] + 1,
        previous + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
      previous = current;
    }
  }
  return row[right.length];
}

function fuzzyMatch(value: string, query: string) {
  const haystack = normalizeSearch(value);
  const needle = normalizeSearch(query.trim());
  if (!needle || haystack.includes(needle)) return true;
  const words = haystack.split(/\s+/).filter(Boolean);
  return needle.split(/\s+/).filter(Boolean).every((queryWord) => words.some((word) => {
    if (word.includes(queryWord) || queryWord.includes(word)) return true;
    if (queryWord.length < 4 || word.length < 4) return false;
    return editDistance(word, queryWord) <= (queryWord.length >= 8 ? 2 : 1);
  }));
}

const DAY_MS = 86_400_000;
const FORTNIGHT_MS = DAY_MS * 14;
const MEETING_ANCHOR = Date.UTC(2026, 8, 14);
const MELBOURNE_TIME_ZONE = 'Australia/Melbourne';

function melbourneDateSerial(date: Date) {
  const parts = new Intl.DateTimeFormat('en-AU', { timeZone: MELBOURNE_TIME_ZONE, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day));
}

function melbourneDateTime(dateSerial: number, hour: number, minute: number) {
  const date = new Date(dateSerial);
  const desired = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour, minute);
  let guess = desired;
  const formatter = new Intl.DateTimeFormat('en-AU', { timeZone: MELBOURNE_TIME_ZONE, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' });
  for (let pass = 0; pass < 2; pass += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).map((part) => [part.type, part.value]));
    const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
    guess += desired - represented;
  }
  return new Date(guess);
}

function buildMeetingSchedule(now: Date) {
  const todaySerial = melbourneDateSerial(now);
  const cyclesSinceAnchor = Math.floor((todaySerial - MEETING_ANCHOR) / FORTNIGHT_MS);
  const cycleMeetingSerial = MEETING_ANCHOR + cyclesSinceAnchor * FORTNIGHT_MS;
  const cycleMeetingTime = melbourneDateTime(cycleMeetingSerial, 9, 30);
  const nextMeetingSerial = cycleMeetingTime.getTime() > now.getTime() ? cycleMeetingSerial : cycleMeetingSerial + FORTNIGHT_MS;
  return { nextMeetingSerial, countdownDays: Math.max(0, Math.round((nextMeetingSerial - todaySerial) / DAY_MS)) };
}

function inferCategory(text: string) {
  const value = text.toLowerCase();
  if (/people|team|leave|culture|recognition/.test(value)) return 'People & culture';
  if (/contract|policy|authority|governance|risk/.test(value)) return 'Governance';
  if (/budget|finance|cost|spend/.test(value)) return 'Finance';
  return 'Operations';
}

function inferOwner(text: string) {
  return EMT_MEMBERS.find((name) => text.toLowerCase().includes(name.toLowerCase())) || 'Coco Hu';
}

function Navigation({ activeView, backlogCount, decisionCount, ownershipCount, onSelect }: { activeView: WorkspaceView; backlogCount: number; decisionCount: number; ownershipCount: number; onSelect: (view: WorkspaceView) => void }) {
  return (
    <SidebarContent className="nav-content"><SidebarGroup className="nav-group"><SidebarGroupContent><SidebarMenu className="nav-menu">
      {[
        { label: 'Next meeting', icon: CalendarDays, view: 'meeting' as WorkspaceView },
        { label: 'Discussion backlog', icon: LayoutList, view: 'backlog' as WorkspaceView, count: backlogCount },
        { label: 'AI summaries', icon: FileUp, view: 'summaries' as WorkspaceView },
        { label: 'Decision log', icon: ClipboardCheck, view: 'decisions' as WorkspaceView, count: decisionCount },
        { label: 'People & ownership', icon: Users, view: 'people' as WorkspaceView, count: ownershipCount },
        { label: 'Reminder settings', icon: Bell, view: 'reminders' as WorkspaceView },
      ].map(({ label, icon: Icon, view, count }) => <SidebarMenuItem key={label}><SidebarMenuButton isActive={activeView === view} className="nav-button" onClick={() => onSelect(view)}><Icon aria-hidden="true" /><span>{label}</span>{count ? <span className="nav-count">{count}</span> : null}</SidebarMenuButton></SidebarMenuItem>)}
    </SidebarMenu></SidebarGroupContent></SidebarGroup><div className="nav-foot"><span className="sample-dot" /><span>Interactive prototype</span></div></SidebarContent>
  );
}

export default function Home() {
  const [topics, setTopics] = React.useState(initialTopics);
  const [backlog, setBacklog] = React.useState(initialBacklog);
  const [activeView, setActiveView] = React.useState<WorkspaceView>('meeting');
  const [selectedTopic, setSelectedTopic] = React.useState<Topic | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [signInOpen, setSignInOpen] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [signedIn, setSignedIn] = React.useState(false);
  const [remindersOn, setRemindersOn] = React.useState(true);
  const [agendaReminderTiming, setAgendaReminderTiming] = React.useState('2 business days before');
  const [followupReminderTiming, setFollowupReminderTiming] = React.useState('1 business day before');
  const [overdueRemindersOn, setOverdueRemindersOn] = React.useState(true);
  const [businessDaysOnly, setBusinessDaysOnly] = React.useState(true);
  const [newTitle, setNewTitle] = React.useState('');
  const [newCategory, setNewCategory] = React.useState('Operations');
  const [newLead, setNewLead] = React.useState('Coco Hu');
  const [newContext, setNewContext] = React.useState('');
  const [newDestination, setNewDestination] = React.useState<WorkspaceView>('meeting');
  const [decisionDraft, setDecisionDraft] = React.useState({ decision: '', followUpOwner: '', followUpAction: '', dueDate: '' });
  const [activeTopicTab, setActiveTopicTab] = React.useState('overview');
  const [search, setSearch] = React.useState('');
  const [decisionSearch, setDecisionSearch] = React.useState('');
  const [now, setNow] = React.useState(() => new Date());
  const [summaryText, setSummaryText] = React.useState('');
  const [summaryFileName, setSummaryFileName] = React.useState('');
  const [summaryMeetingDate, setSummaryMeetingDate] = React.useState('2026-09-28');
  const [analysisState, setAnalysisState] = React.useState<'idle' | 'analysing' | 'review'>('idle');
  const [summaryError, setSummaryError] = React.useState('');
  const [extractedDecisions, setExtractedDecisions] = React.useState<ExtractedDecision[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const meetingSchedule = React.useMemo(() => buildMeetingSchedule(now), [now]);
  const meetingDateLong = new Intl.DateTimeFormat('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(meetingSchedule.nextMeetingSerial));
  const meetingDateIso = new Date(meetingSchedule.nextMeetingSerial).toISOString().slice(0, 10);
  const filteredTopics = topics.filter((topic) => fuzzyMatch(`${topic.title} ${topic.category} ${topic.lead}`, search));
  const recordedDecisions = [...topics, ...backlog].filter((topic) => topic.decision);
  const sortedDecisions = [...recordedDecisions].sort((a, b) => (b.decisionDateIso || '').localeCompare(a.decisionDateIso || ''));
  const filteredDecisions = sortedDecisions.filter((topic) => fuzzyMatch(`${topic.title} ${topic.category} ${topic.decision} ${topic.followUpOwner} ${topic.followUpAction}`, decisionSearch));
  const decisionGroups = Object.entries(filteredDecisions.reduce<Record<string, Topic[]>>((groups, topic) => { (groups[topic.category] ||= []).push(topic); return groups; }, {})).sort(([, a], [, b]) => (b[0]?.decisionDateIso || '').localeCompare(a[0]?.decisionDateIso || ''));
  const totalMinutes = topics.reduce((sum, topic) => sum + Number.parseInt(topic.time, 10), 0);
  const ownershipItems: OwnershipItem[] = [
    ...recordedDecisions.filter((topic) => topic.followUpOwner).map((topic) => ({ id: topic.id * 10 + 1, owner: topic.followUpOwner, initials: topic.followUpOwner.split(' ').map((part) => part[0]).join(''), kind: 'Follow-up' as const, topic, action: topic.followUpAction || 'Complete the agreed follow-up.', due: formatDueDate(topic.dueDate) })),
    ...topics.filter((topic) => !topic.decision && topic.lead !== 'Unassigned').map((topic) => ({ id: topic.id * 10 + 2, owner: topic.lead, initials: topic.leadInitials, kind: 'Meeting preparation' as const, topic, action: topic.prepAction, due: 'For next executive meeting' })),
    ...topics.filter((topic) => topic.lead === 'Unassigned').map((topic) => ({ id: topic.id * 10 + 3, owner: 'Unassigned', initials: '—', kind: 'Unassigned' as const, topic, action: topic.prepAction, due: 'Needs owner now' })),
  ];
  const ownerGroups = Object.entries(ownershipItems.reduce<Record<string, OwnershipItem[]>>((groups, item) => { (groups[item.owner] ||= []).push(item); return groups; }, {}));

  React.useEffect(() => {
    const requestedView = new URLSearchParams(window.location.search).get('view');
    if (requestedView === 'meeting' || requestedView === 'backlog' || requestedView === 'summaries' || requestedView === 'decisions' || requestedView === 'people' || requestedView === 'reminders') queueMicrotask(() => setActiveView(requestedView));
  }, []);

  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  React.useEffect(() => {
    const context = (document as Document & { modelContext?: WebMCPContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: 'stage_discussion', title: 'Stage a discussion',
      description: 'Add a sample discussion to the visible GMS executive meeting agenda. This changes only the current prototype session.',
      inputSchema: { type: 'object', properties: { title: { type: 'string', minLength: 1, maxLength: 120 } }, required: ['title'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        const value = input as { title?: unknown };
        if (typeof value?.title !== 'string' || !value.title.trim() || value.title.trim().length > 120) throw new Error('Provide a discussion title between 1 and 120 characters.');
        const topic: Topic = { id: Date.now(), title: value.title.trim(), category: 'Operations', status: 'Scheduled', lead: 'Coco Hu', leadInitials: 'CH', time: '10 min', note: 'New sample discussion staged by a browser tool.', reminder: 'Not scheduled', prepAction: 'Add preparation notes.', decision: '', followUpOwner: '', followUpAction: '', dueDate: '', source: 'Agenda', remindLead: false, remindFollowup: false };
        setTopics((current) => [...current, topic]);
        return { id: topic.id, status: 'staged', mock: true };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  function addTopic(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    const topic: Topic = { id: Date.now(), title, category: newCategory, status: 'Scheduled', lead: newLead, leadInitials: newLead.split(' ').map((part) => part[0]).join(''), time: '10 min', note: newContext.trim() || 'No preparation context has been added yet.', reminder: 'Not scheduled', prepAction: newContext.trim() || 'Add the material needed for discussion.', decision: '', followUpOwner: '', followUpAction: '', dueDate: '', source: 'Agenda', remindLead: false, remindFollowup: false };
    if (newDestination === 'backlog') setBacklog((current) => [...current, topic]); else setTopics((current) => [...current, topic]);
    setNewTitle(''); setNewContext(''); setNewLead('Coco Hu'); setNewCategory('Operations'); setAddOpen(false);
    toast.add({ type: 'success', title: 'Discussion added', description: newDestination === 'backlog' ? 'It is now in the discussion backlog.' : 'It is now on the next meeting agenda.' });
  }

  function selectView(view: WorkspaceView) {
    setActiveView(view);
    const url = new URL(window.location.href); url.searchParams.set('view', view); window.history.replaceState({}, '', url);
  }

  function openTopic(topic: Topic, tab = 'overview') {
    setSelectedTopic(topic); setActiveTopicTab(tab);
    setDecisionDraft({ decision: topic.decision, followUpOwner: topic.followUpOwner, followUpAction: topic.followUpAction, dueDate: topic.dueDate });
  }

  function updateTopic(updated: Topic) {
    setTopics((current) => current.map((topic) => topic.id === updated.id ? updated : topic));
    setBacklog((current) => current.map((topic) => topic.id === updated.id ? updated : topic));
    setSelectedTopic(updated);
  }

  function assignProposer(lead: string) {
    if (!selectedTopic) return;
    updateTopic({ ...selectedTopic, lead, leadInitials: lead.split(' ').map((part) => part[0]).join('') });
    toast.add({ type: 'success', title: 'Proposer updated', description: `${lead} is now shown as the topic proposer.` });
  }

  function saveDecision() {
    if (!selectedTopic) return;
    updateTopic({ ...selectedTopic, ...decisionDraft, decisionDate: decisionDraft.decision ? selectedTopic.decisionDate || meetingDateLong : undefined, decisionDateIso: decisionDraft.decision ? selectedTopic.decisionDateIso || meetingDateIso : undefined });
    toast.add({ type: 'success', title: 'Decision saved', description: 'The editable decision is now visible in the decision log.' });
  }

  function moveToAgenda(topic: Topic) {
    setBacklog((current) => current.filter((item) => item.id !== topic.id)); setTopics((current) => [...current, topic]);
    toast.add({ type: 'success', title: 'Moved to next meeting', description: topic.title });
  }

  function simulateSignIn() {
    setSignedIn(true); setSignInOpen(false);
    toast.add({ type: 'success', title: 'Microsoft account connected', description: 'Simulation only — no real account or mailbox was accessed.' });
  }

  async function handleSummaryFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setSummaryError('');
    if (!/\.(txt|md)$/i.test(file.name)) { setSummaryFileName(''); setSummaryError('This prototype reads TXT and Markdown files. Paste Word or PDF summary text into the field below.'); return; }
    if (file.size > 2_000_000) { setSummaryError('Please use a text file smaller than 2 MB for this prototype.'); return; }
    const text = await file.text();
    if (!text.trim()) { setSummaryError('The uploaded file is empty.'); return; }
    setSummaryFileName(file.name); setSummaryText(text); setExtractedDecisions([]); setAnalysisState('idle');
  }

  function updateExtractedDecision(id: number, change: Partial<ExtractedDecision>) {
    setExtractedDecisions((current) => current.map((decision) => decision.id === id ? { ...decision, ...change } : decision));
  }

  async function analyseSummary() {
    const content = summaryText.trim();
    if (content.length < 30) { setSummaryError('Add a little more meeting detail before running the analysis.'); return; }
    setSummaryError(''); setAnalysisState('analysing');
    await new Promise((resolve) => window.setTimeout(resolve, 650));
    const candidates = content.split(/\n+/).map((line) => line.replace(/^[-*•\s]+/, '').trim()).filter((line) => line.length > 24 && /decision|decided|agreed|approved|confirmed|action/i.test(line));
    const sourceLines = (candidates.length ? candidates : content.split(/[.!?]\n*/).filter((line) => line.trim().length > 30)).slice(0, 3);
    const dueDate = new Date(new Date(`${summaryMeetingDate}T00:00:00Z`).getTime() + 7 * DAY_MS).toISOString().slice(0, 10);
    setExtractedDecisions(sourceLines.map((line, index) => {
      const clean = line.replace(/^(decision|action)\s*:\s*/i, '').trim();
      const title = clean.split(/\.|;| and /)[0].trim().slice(0, 82) || `Meeting decision ${index + 1}`;
      const owner = inferOwner(clean);
      return { id: Date.now() + index, selected: true, title, category: inferCategory(clean), decision: clean, owner, action: /will\s+/i.test(clean) ? clean.slice(clean.toLowerCase().indexOf('will ') + 5).replace(/\.$/, '') : 'Confirm the next action after review.', dueDate };
    }));
    setAnalysisState('review');
  }

  function addExtractedToDecisionLog() {
    const selected = extractedDecisions.filter((decision) => decision.selected && decision.title.trim() && decision.decision.trim());
    if (!selected.length) { setSummaryError('Select at least one complete decision draft.'); return; }
    const additions: Topic[] = selected.map((draft, index) => ({ id: Date.now() + index, title: draft.title.trim(), category: draft.category, status: 'Scheduled', lead: draft.owner, leadInitials: draft.owner.split(' ').map((part) => part[0]).join(''), time: '—', note: 'Extracted from a reviewed meeting summary.', reminder: 'Not scheduled', prepAction: '', decision: draft.decision.trim(), followUpOwner: draft.owner, followUpAction: draft.action.trim(), dueDate: draft.dueDate, decisionDate: formatDecisionDate(summaryMeetingDate, undefined), decisionDateIso: summaryMeetingDate, source: 'AI summary', remindLead: false, remindFollowup: false }));
    setTopics((current) => [...current, ...additions]);
    toast.add({ type: 'success', title: `${additions.length} decision${additions.length === 1 ? '' : 's'} added`, description: 'They are editable in the decision log.' });
    setExtractedDecisions([]); setAnalysisState('idle'); selectView('decisions');
  }

  return (
    <Toaster><div className="app-shell">
      <header className="brand-header"><div className="brand-lockup"><Image src="/assets/gms-logo-white.png" alt="GMS 10 Years" className="gms-logo" width={150} height={34} priority /><span className="brand-divider" aria-hidden="true" /><span className="product-name">Executive Projects</span></div><div className="header-actions"><Badge className="demo-badge">Interactive prototype</Badge><Button variant="ghost" className={`microsoft-button ${signedIn ? 'is-connected' : ''}`} onClick={() => setSignInOpen(true)}>{signedIn ? <Check aria-hidden="true" /> : <LogIn aria-hidden="true" />}<span>{signedIn ? 'Microsoft connected' : 'Sign in with Microsoft'}</span></Button></div></header>

      <SidebarProvider className="workspace-provider"><div className="workspace-layout"><Sidebar collapsible="none" className="workspace-sidebar"><Navigation activeView={activeView} backlogCount={backlog.length} decisionCount={recordedDecisions.length} ownershipCount={ownershipItems.length} onSelect={selectView} /></Sidebar><main className="workspace-main" id="workspace-main">
        <div className="mobile-topbar"><Button variant="outline" className="mobile-menu-button" aria-expanded={mobileNavOpen} aria-controls="mobile-navigation" onClick={() => setMobileNavOpen(true)}><Menu aria-hidden="true" />Menu</Button><Badge className="demo-badge mobile-demo">Prototype</Badge></div>

        {activeView === 'meeting' ? <><section className="meeting-intro" aria-labelledby="meeting-title"><div><p className="meeting-date">Biweekly · every second Monday</p><h1 id="meeting-title">Next executive meeting</h1></div><Button className="primary-action" size="lg" onClick={() => { setNewDestination('meeting'); setAddOpen(true); }}><Plus aria-hidden="true" />Add topic</Button></section>
          <section className="next-meeting-card" aria-label="Next executive meeting date"><div><span>Next executive meeting</span><strong>{meetingDateLong}</strong></div><Badge className="countdown-badge">{meetingSchedule.countdownDays === 0 ? 'Today' : `${meetingSchedule.countdownDays} days to go`}</Badge></section>
          <section className="agenda-panel" aria-labelledby="agenda-heading"><div className="panel-toolbar"><div><h2 id="agenda-heading">Next executive meeting agenda</h2><p>{topics.length} topics · {totalMinutes} minutes planned</p></div><label className="search-field" htmlFor="agenda-search"><Search aria-hidden="true" /><span className="sr-only">Search agenda</span><Input id="agenda-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search agenda" /></label></div><div className="agenda-list">
            {filteredTopics.map((topic, index) => <button type="button" className="agenda-row" key={topic.id} onClick={() => openTopic(topic)}><span className="agenda-order">{String(index + 1).padStart(2, '0')}</span><span className="agenda-summary"><span className="agenda-title">{topic.title}</span><span className="agenda-meta"><span className="topic-tag">{topic.category}</span><span>Proposed by {topic.lead}</span></span></span><span className="agenda-duration"><Clock3 aria-hidden="true" />{topic.time}</span><ChevronRight className="row-chevron" aria-hidden="true" /></button>)}
            {filteredTopics.length === 0 ? <div className="empty-state"><Search aria-hidden="true" /><strong>No matching topics</strong><span>Try another title, category or proposer.</span></div> : null}
          </div></section>
          <section className="summary-shortcut" aria-label="Upload meeting summary"><span className="summary-shortcut-icon"><FileUp aria-hidden="true" /></span><div><strong>After the meeting</strong><p>Upload your reviewed Wispr Flow summary and turn agreed outcomes into editable decision drafts.</p></div><Button variant="outline" onClick={() => selectView('summaries')}>Upload summary<ChevronRight aria-hidden="true" /></Button></section>
        </> : activeView === 'backlog' ? <section className="backlog-view" aria-labelledby="backlog-title"><div className="meeting-intro"><div><p className="meeting-date">Topics waiting for a future agenda</p><h1 id="backlog-title">Discussion backlog</h1><p className="intro-copy">Move a topic into the next meeting when it is ready for the EMT.</p></div><Button className="primary-action" size="lg" onClick={() => { setNewDestination('backlog'); setAddOpen(true); }}><Plus aria-hidden="true" />Add to backlog</Button></div><section className="agenda-panel backlog-panel"><div className="panel-toolbar"><div><h2>Waiting for discussion</h2><p>{backlog.length} prototype topics</p></div></div><div className="agenda-list">{backlog.map((topic, index) => <div className="backlog-row" key={topic.id}><button type="button" className="backlog-open" onClick={() => openTopic(topic)}><span className="agenda-order">{String(index + 1).padStart(2, '0')}</span><span className="agenda-summary"><span className="agenda-topline"><span className="agenda-title">{topic.title}</span><StatusBadge status={topic.status} /></span><span className="agenda-meta"><span className="topic-tag">{topic.category}</span><span>Proposed by {topic.lead}</span></span></span></button><Button variant="secondary" onClick={() => moveToAgenda(topic)}>Move to next meeting</Button></div>)}{backlog.length === 0 ? <div className="empty-state"><CheckCircle2 aria-hidden="true" /><strong>Backlog cleared</strong><span>Every discussion has been placed on an agenda.</span></div> : null}</div></section></section>
        : activeView === 'summaries' ? <section className="summaries-view" aria-labelledby="summaries-title"><div className="meeting-intro"><div><p className="meeting-date">From reviewed transcript to decision record</p><h1 id="summaries-title">AI meeting summary</h1><p className="intro-copy">Upload or paste your reviewed Wispr Flow summary, check the extracted decisions, then add only the approved drafts to the log.</p></div></div><div className="summary-layout">
          <section className="summary-upload-panel" aria-labelledby="summary-source-title"><div className="panel-toolbar"><div><h2 id="summary-source-title">1. Add reviewed summary</h2><p>TXT or Markdown · up to 2 MB</p></div><Badge className="local-badge">Local prototype</Badge></div><div className="summary-panel-body"><input ref={fileInputRef} className="sr-only" type="file" accept=".txt,.md,text/plain,text/markdown" onChange={handleSummaryFile} /><button type="button" className="upload-dropzone" onClick={() => fileInputRef.current?.click()}><UploadCloud aria-hidden="true" /><strong>{summaryFileName || 'Choose a reviewed summary'}</strong><span>{summaryFileName ? 'Choose another TXT or Markdown file' : 'Upload TXT / Markdown, or paste the content below'}</span></button><div className="summary-form-row"><label htmlFor="summary-meeting-date"><span>Meeting date</span><Input id="summary-meeting-date" type="date" value={summaryMeetingDate} onChange={(event) => setSummaryMeetingDate(event.target.value)} /></label><Button variant="ghost" onClick={() => { setSummaryText(SAMPLE_SUMMARY); setSummaryFileName('Sample summary'); setExtractedDecisions([]); setAnalysisState('idle'); setSummaryError(''); }}><FileText aria-hidden="true" />Load sample</Button></div><label className="summary-text-field" htmlFor="summary-text"><span>Reviewed meeting summary</span><Textarea id="summary-text" value={summaryText} onChange={(event) => { setSummaryText(event.target.value); setExtractedDecisions([]); setAnalysisState('idle'); }} placeholder="Paste the reviewed Wispr Flow meeting summary here…" /></label>{summaryError ? <p className="form-error" role="alert"><CircleAlert aria-hidden="true" />{summaryError}</p> : null}<Button className="primary-action analyse-button" onClick={analyseSummary} disabled={analysisState === 'analysing'}><WandSparkles aria-hidden="true" />{analysisState === 'analysing' ? 'Analysing summary…' : 'Analyse summary'}</Button><p className="prototype-note">Prototype analysis runs only in this browser. A production LLM, secure file storage and audit trail are not connected yet.</p></div></section>
          <section className="analysis-panel" aria-labelledby="analysis-review-title"><div className="panel-toolbar"><div><h2 id="analysis-review-title">2. Review decision drafts</h2><p>Edit every field before adding it to the log.</p></div>{extractedDecisions.length ? <Badge className="draft-count">{extractedDecisions.length} drafts</Badge> : null}</div>{analysisState === 'analysing' ? <div className="analysis-empty"><Sparkles aria-hidden="true" /><strong>Finding decisions and owners…</strong><span>This demonstrates the intended LLM step.</span></div> : extractedDecisions.length ? <div className="extracted-list">{extractedDecisions.map((draft) => <article className={`extracted-card ${draft.selected ? '' : 'is-unselected'}`} key={draft.id}><label className="draft-selector"><input type="checkbox" checked={draft.selected} onChange={(event) => updateExtractedDecision(draft.id, { selected: event.target.checked })} /><span>Include in decision log</span></label><label><span>Decision title</span><Input value={draft.title} onChange={(event) => updateExtractedDecision(draft.id, { title: event.target.value })} /></label><label><span>Decision</span><Textarea value={draft.decision} onChange={(event) => updateExtractedDecision(draft.id, { decision: event.target.value })} /></label><div className="draft-grid"><label><span>Topic</span><NativeSelect value={draft.category} onChange={(event) => updateExtractedDecision(draft.id, { category: event.target.value })}>{TOPIC_CATEGORIES.map((category) => <NativeSelectOption key={category}>{category}</NativeSelectOption>)}</NativeSelect></label><label><span>Owner</span><NativeSelect value={draft.owner} onChange={(event) => updateExtractedDecision(draft.id, { owner: event.target.value })}>{EMT_MEMBERS.map((member) => <NativeSelectOption key={member}>{member}</NativeSelectOption>)}</NativeSelect></label></div><label><span>Next action</span><Input value={draft.action} onChange={(event) => updateExtractedDecision(draft.id, { action: event.target.value })} /></label><label><span>Due date</span><Input type="date" value={draft.dueDate} onChange={(event) => updateExtractedDecision(draft.id, { dueDate: event.target.value })} /></label></article>)}<div className="analysis-actions"><Button className="primary-action" onClick={addExtractedToDecisionLog}><Check aria-hidden="true" />Add selected to decision log</Button></div></div> : <div className="analysis-empty"><WandSparkles aria-hidden="true" /><strong>No analysis yet</strong><span>Add the reviewed summary, then run the analysis to create editable drafts.</span></div>}</section>
        </div></section>
        : activeView === 'decisions' ? <section className="decisions-view" aria-labelledby="decisions-title"><div className="meeting-intro"><div><p className="meeting-date">Grouped by topic · newest first</p><h1 id="decisions-title">Decision log</h1><p className="intro-copy">Find what was agreed, edit the record and keep the follow-up owner visible.</p></div><Button className="primary-action" onClick={() => selectView('summaries')}><FileUp aria-hidden="true" />Upload summary</Button></div><section className="decisions-panel" aria-labelledby="decision-log-title"><div className="panel-toolbar"><div><h2 id="decision-log-title">Recorded decisions</h2><p>{filteredDecisions.length} of {recordedDecisions.length} decisions · date descending</p></div><label className="search-field decision-search" htmlFor="decision-search"><Search aria-hidden="true" /><span className="sr-only">Fuzzy search decisions</span><Input id="decision-search" value={decisionSearch} onChange={(event) => setDecisionSearch(event.target.value)} placeholder="Fuzzy search decisions" /></label></div><div className="decision-groups">{decisionGroups.map(([category, decisions]) => <section className="decision-group" key={category}><header className="decision-group-head"><span className="decision-category">{category}</span><span>{decisions.length} {decisions.length === 1 ? 'decision' : 'decisions'}</span></header><div className="decision-list">{decisions.map((topic) => <button type="button" className="decision-row" key={topic.id} onClick={() => openTopic(topic, 'decision')}><span className="decision-date">{formatDecisionDate(topic.decisionDateIso, topic.decisionDate)}<small>{topic.source || 'Agenda'}</small></span><span className="decision-summary"><span className="decision-topic">{topic.title}</span><span className="decision-copy">{topic.decision}</span></span><span className="decision-followup"><small>Next action</small><strong>{topic.followUpAction || 'Not added'}</strong><small>{topic.followUpOwner || 'Not assigned'} · Due {formatDueDate(topic.dueDate)}</small></span><ChevronRight className="row-chevron" aria-hidden="true" /></button>)}</div></section>)}{filteredDecisions.length === 0 ? <div className="empty-state"><Search aria-hidden="true" /><strong>No matching decisions</strong><span>Try a title, topic, owner or part of a phrase.</span></div> : null}</div></section></section>
        : activeView === 'people' ? <section className="people-view" aria-labelledby="people-title"><div className="meeting-intro"><div><p className="meeting-date">What each EMT member needs to move next</p><h1 id="people-title">People &amp; Ownership</h1><p className="intro-copy">One follow-up view across meeting preparation and recorded decisions.</p></div></div><section className="people-panel" aria-label="Ownership by person"><div className="panel-toolbar"><div><h2>Ownership ledger</h2><p>{ownershipItems.length} active actions across {ownerGroups.length} owners</p></div><div className="ownership-legend"><span><i className="legend-dot is-prep" />Before meeting</span><span><i className="legend-dot is-followup" />After decision</span></div></div><div className="owner-groups">{ownerGroups.map(([owner, items]) => <section className={`owner-group ${owner === 'Unassigned' ? 'is-unassigned' : ''}`} key={owner}><header className="owner-head"><span className="owner-avatar">{items[0].initials}</span><div><h3>{owner}</h3><p>{items.length} {items.length === 1 ? 'action' : 'actions'} to move</p></div></header><div className="ownership-list">{items.map((item) => <button type="button" className="ownership-item" key={item.id} onClick={() => openTopic(item.topic, item.kind === 'Follow-up' ? 'decision' : 'overview')}><span className={`ownership-kind kind-${item.kind.toLowerCase().replace(' ', '-')}`}>{item.kind}</span><span className="ownership-copy"><strong>{item.action}</strong><small>{item.topic.title}</small></span><span className="ownership-due"><CalendarDays aria-hidden="true" />{item.due}</span><ChevronRight className="row-chevron" aria-hidden="true" /></button>)}</div></section>)}</div></section></section>
        : <section className="reminders-view" aria-labelledby="reminders-title"><div className="meeting-intro"><div><p className="meeting-date">Microsoft-connected follow-through</p><h1 id="reminders-title">Reminder settings</h1><p className="intro-copy">Define who is reminded, when it happens and which action the message refers to.</p></div></div><div className="settings-layout"><section className="settings-panel" aria-labelledby="reminder-rules-title"><div className="settings-section connection-section"><div><span className="icon-tile"><LogIn aria-hidden="true" /></span><div><h2>Microsoft connection</h2><p>{signedIn ? 'Connected in this prototype session' : 'Required for Outlook and calendar reminders'}</p></div></div><Button variant={signedIn ? 'outline' : 'default'} className={signedIn ? '' : 'primary-action'} onClick={() => setSignInOpen(true)}>{signedIn ? <><Check aria-hidden="true" />Connected</> : 'Connect Microsoft'}</Button></div><div className="settings-section global-setting"><div><h2 id="reminder-rules-title">Automatic reminders</h2><p>Apply the rules below to topic proposers and follow-up owners.</p></div><Switch checked={signedIn && remindersOn} disabled={!signedIn} onCheckedChange={setRemindersOn} aria-label="Automatic reminders" /></div><div className="settings-section reminder-rules"><div className="setting-row"><div className="rule-copy"><Bell aria-hidden="true" /><span><strong>Agenda proposer reminder</strong><small>Ask the topic proposer to prepare input before the meeting.</small></span></div><NativeSelect value={agendaReminderTiming} onChange={(event) => setAgendaReminderTiming(event.target.value)} disabled={!signedIn || !remindersOn}><NativeSelectOption>1 business day before</NativeSelectOption><NativeSelectOption>2 business days before</NativeSelectOption><NativeSelectOption>3 business days before</NativeSelectOption></NativeSelect></div><div className="setting-row"><div className="rule-copy"><ClipboardCheck aria-hidden="true" /><span><strong>Follow-up reminder</strong><small>Remind the named owner before an agreed action is due.</small></span></div><NativeSelect value={followupReminderTiming} onChange={(event) => setFollowupReminderTiming(event.target.value)} disabled={!signedIn || !remindersOn}><NativeSelectOption>On the due date</NativeSelectOption><NativeSelectOption>1 business day before</NativeSelectOption><NativeSelectOption>2 business days before</NativeSelectOption></NativeSelect></div><div className="setting-row"><div className="rule-copy"><CircleAlert aria-hidden="true" /><span><strong>Overdue follow-up</strong><small>Send a weekday nudge until the owner marks the action complete.</small></span></div><Switch checked={overdueRemindersOn} onCheckedChange={setOverdueRemindersOn} disabled={!signedIn || !remindersOn} aria-label="Overdue follow-up reminders" /></div><div className="setting-row"><div className="rule-copy"><CalendarDays aria-hidden="true" /><span><strong>Business days only</strong><small>Do not send reminders on weekends. Time zone: Australia/Melbourne.</small></span></div><Switch checked={businessDaysOnly} onCheckedChange={setBusinessDaysOnly} disabled={!signedIn || !remindersOn} aria-label="Business days only" /></div></div></section><aside className="reminder-preview" aria-labelledby="preview-reminders-title"><div className="preview-head"><span className="icon-tile"><Mail aria-hidden="true" /></span><div><h2 id="preview-reminders-title">Next scheduled reminders</h2><p>Preview of the messages that would be prepared.</p></div></div><div className="recipient-strip"><span>Recipients</span><strong>Topic proposers · Follow-up owners</strong></div><div className="preview-list"><article className="preview-message"><span className="preview-time">2 business days before</span><strong>George — input needed for contract signing authority</strong><p>Bring the current thresholds and flagged policy gaps to the next meeting.</p></article><article className="preview-message"><span className="preview-time">1 business day before due</span><strong>Brenda — leave coverage action approaching</strong><p>Set up the shared coverage calendar and circulate the handover template.</p></article></div><p className="mock-note">Simulation only — no email or calendar event will be created.</p></aside></div></section>}
      </main></div></SidebarProvider>

      <Dialog open={addOpen} onOpenChange={setAddOpen}><DialogContent className="form-dialog"><form onSubmit={addTopic}><DialogHeader><DialogTitle>Add a discussion topic</DialogTitle><DialogDescription>Capture what the EMT should discuss and who proposed it.</DialogDescription></DialogHeader><div className="form-stack"><label htmlFor="discussion-title"><span>Topic title</span><Input id="discussion-title" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="What needs discussion or a decision?" required /></label><label htmlFor="discussion-destination"><span>Destination</span><NativeSelect id="discussion-destination" value={newDestination} onChange={(event) => setNewDestination(event.target.value as WorkspaceView)}><NativeSelectOption value="meeting">Next executive meeting</NativeSelectOption><NativeSelectOption value="backlog">Discussion backlog</NativeSelectOption></NativeSelect></label><div className="form-pair"><label htmlFor="discussion-category"><span>Topic</span><NativeSelect id="discussion-category" value={newCategory} onChange={(event) => setNewCategory(event.target.value)}>{TOPIC_CATEGORIES.map((category) => <NativeSelectOption key={category}>{category}</NativeSelectOption>)}</NativeSelect></label><label htmlFor="discussion-lead"><span>Proposed by</span><NativeSelect id="discussion-lead" value={newLead} onChange={(event) => setNewLead(event.target.value)}>{EMT_MEMBERS.map((member) => <NativeSelectOption key={member}>{member}</NativeSelectOption>)}</NativeSelect></label></div><label htmlFor="discussion-context"><span>Context for the meeting</span><Textarea id="discussion-context" value={newContext} onChange={(event) => setNewContext(event.target.value)} placeholder="Add the decision needed, useful links or preparation notes." /></label></div><DialogFooter><DialogClose render={<Button variant="ghost" type="button" />}>Cancel</DialogClose><Button type="submit" className="primary-action">Add topic</Button></DialogFooter></form></DialogContent></Dialog>

      <Dialog open={signInOpen} onOpenChange={setSignInOpen}><DialogContent className="signin-dialog"><DialogHeader><span className="signin-icon"><LogIn aria-hidden="true" /></span><DialogTitle>{signedIn ? 'Microsoft connection' : 'Connect your Microsoft account'}</DialogTitle><DialogDescription>{signedIn ? 'This prototype account shows how the live connection could be managed.' : 'The live product would request permission to sign you in and prepare Outlook reminders and calendar context.'}</DialogDescription></DialogHeader><div className="permission-list"><div><UserRound aria-hidden="true" /><span><strong>Basic profile</strong><small>Identify you inside the executive workspace</small></span></div><div><Mail aria-hidden="true" /><span><strong>Outlook mail</strong><small>Prepare reminder messages for assigned people</small></span></div><div><CalendarDays aria-hidden="true" /><span><strong>Calendar</strong><small>Connect the fortnightly meeting and due dates</small></span></div></div><p className="mock-note">This is a safe simulation. No Microsoft sign-in will open and no permissions are requested.</p><DialogFooter><DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose><Button className="primary-action" onClick={simulateSignIn}>{signedIn ? 'Done' : 'Simulate Microsoft sign-in'}</Button></DialogFooter></DialogContent></Dialog>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}><SheetContent side="left" id="mobile-navigation" className="mobile-nav-sheet"><SheetHeader><SheetTitle>Executive Projects</SheetTitle><SheetDescription>Workspace navigation</SheetDescription></SheetHeader><Navigation activeView={activeView} backlogCount={backlog.length} decisionCount={recordedDecisions.length} ownershipCount={ownershipItems.length} onSelect={(view) => { selectView(view); setMobileNavOpen(false); }} /></SheetContent></Sheet>

      <Sheet open={Boolean(selectedTopic)} onOpenChange={(open) => !open && setSelectedTopic(null)}><SheetContent className="topic-sheet">{selectedTopic ? <><div className="topic-sheet-header"><Badge className="topic-category">{selectedTopic.category}</Badge><SheetHeader><SheetTitle>{selectedTopic.title}</SheetTitle><SheetDescription>Executive meeting record · editable prototype</SheetDescription></SheetHeader></div><Tabs value={activeTopicTab} onValueChange={setActiveTopicTab} className="topic-tabs"><TabsList className="topic-tab-list"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="decision">Decision</TabsTrigger><TabsTrigger value="reminders">Reminders</TabsTrigger></TabsList><TabsContent value="overview" className="tab-panel"><p className="topic-note">{selectedTopic.note}</p><label className="owner-control" htmlFor="topic-lead"><span>Proposed by</span><NativeSelect id="topic-lead" value={selectedTopic.lead} onChange={(event) => assignProposer(event.target.value)}>{EMT_MEMBERS.map((member) => <NativeSelectOption key={member}>{member}</NativeSelectOption>)}</NativeSelect></label><div className="detail-grid"><div><span>Agenda time</span><strong>{selectedTopic.time}</strong></div><div><span>Topic</span><strong>{selectedTopic.category}</strong></div><div><span>Decision</span><strong>{selectedTopic.decision ? 'Recorded' : 'Pending meeting'}</strong></div><div><span>Follow-up</span><strong>{selectedTopic.followUpOwner || 'Not assigned'}</strong></div></div></TabsContent><TabsContent value="decision" className="tab-panel"><div className="decision-placeholder"><MessageSquareText aria-hidden="true" /><h3>Review and edit the decision</h3><p>Keep what was agreed, the owner, next action and due date in one editable record.</p>{selectedTopic.decision ? <div className="saved-decision"><strong>Current decision</strong><span>{selectedTopic.decision}</span><small>Next action: {selectedTopic.followUpAction || 'Not added'}</small><small>Owner: {selectedTopic.followUpOwner || 'Not assigned'} · Due: {formatDueDate(selectedTopic.dueDate)}</small></div> : null}<label className="decision-field" htmlFor="decision-rationale"><span>Decision and rationale</span><Textarea id="decision-rationale" value={decisionDraft.decision} onChange={(event) => setDecisionDraft((draft) => ({ ...draft, decision: event.target.value }))} placeholder="What was agreed?" /></label><label className="decision-field" htmlFor="decision-action"><span>Next action</span><Input id="decision-action" value={decisionDraft.followUpAction} onChange={(event) => setDecisionDraft((draft) => ({ ...draft, followUpAction: event.target.value }))} placeholder="What needs to happen next?" /></label><div className="form-pair"><label className="decision-field" htmlFor="decision-owner"><span>Follow-up owner</span><NativeSelect id="decision-owner" value={decisionDraft.followUpOwner} onChange={(event) => setDecisionDraft((draft) => ({ ...draft, followUpOwner: event.target.value }))}><NativeSelectOption value="">Not assigned</NativeSelectOption>{EMT_MEMBERS.map((member) => <NativeSelectOption key={member}>{member}</NativeSelectOption>)}</NativeSelect></label><label className="decision-field" htmlFor="decision-due-date"><span>Due date</span><Input id="decision-due-date" value={decisionDraft.dueDate} onChange={(event) => setDecisionDraft((draft) => ({ ...draft, dueDate: event.target.value }))} type="date" /></label></div><Button className="primary-action" onClick={saveDecision}><Check aria-hidden="true" />Save decision</Button></div></TabsContent><TabsContent value="reminders" className="tab-panel"><div className="reminder-setting-row"><div><Bell aria-hidden="true" /><span><strong>Proposer reminder</strong><small>{signedIn && remindersOn ? 'Send before the meeting' : signedIn ? 'Automatic reminders are paused' : 'Connect Microsoft to activate'}</small></span></div><Switch checked={signedIn && remindersOn && selectedTopic.remindLead} disabled={!signedIn || !remindersOn} onCheckedChange={(checked) => updateTopic({ ...selectedTopic, remindLead: checked })} aria-label="Proposer reminder" /></div><div className="reminder-setting-row"><div><ClipboardCheck aria-hidden="true" /><span><strong>Follow-up reminder</strong><small>{signedIn && remindersOn ? 'Send before the action due date' : signedIn ? 'Automatic reminders are paused' : 'Connect Microsoft to activate'}</small></span></div><Switch checked={signedIn && remindersOn && selectedTopic.remindFollowup} disabled={!signedIn || !remindersOn} onCheckedChange={(checked) => updateTopic({ ...selectedTopic, remindFollowup: checked })} aria-label="Follow-up reminder" /></div><div className="integration-callout"><Sparkles aria-hidden="true" /><p><strong>{signedIn ? 'Microsoft Graph connected' : 'Microsoft Graph connection needed'}</strong><span>{signedIn ? remindersOn ? 'Reminder preferences are active in this prototype session.' : 'The Microsoft connection is ready, but automatic reminders are paused.' : 'The production version would request delegated work-account permissions under your organisation’s security policy.'}</span></p></div></TabsContent></Tabs></> : null}</SheetContent></Sheet>
    </div></Toaster>
  );
}
