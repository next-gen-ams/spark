'use client';

import * as React from 'react';
import Image from 'next/image';
import {
  Archive, Bell, CalendarDays, Check, CheckCircle2, ChevronRight, CircleAlert,
  ClipboardCheck, Clock3, LayoutList, LogIn, Mail, Menu,
  MessageSquareText, Plus, Search, Sparkles, UserRound,
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
type WorkspaceView = 'meeting' | 'backlog' | 'decisions' | 'reminders';
type DecisionTab = 'People & culture' | 'Operations' | 'Governance' | 'Finance' | 'Archived';
type Topic = {
  id: number; title: string; category: string; status: TopicStatus;
  lead: string; leadInitials: string; time: string; note: string; reminder: string;
  decision: string; followUpOwner: string; dueDate: string; followUpAction: string; prepAction: string;
  decisionDate?: string; decisionDateIso?: string; source?: 'Agenda';
  remindLead: boolean; remindFollowup: boolean;
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
const TOPIC_CATEGORIES: Exclude<DecisionTab, 'Archived'>[] = ['People & culture', 'Operations', 'Governance', 'Finance'];

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

const initialHistoricalDecisions: Topic[] = [
  { id: 201, title: 'Approve FY27 software subscription budget', category: 'Finance', status: 'Scheduled', lead: 'George Pesutto', leadInitials: 'GP', time: '12 min', note: 'Review core subscriptions and the evidence needed for any plan upgrades.', reminder: 'Completed', prepAction: '', decision: 'Keep core tools on standard plans and review upgrade requests against measured team usage.', followUpOwner: 'Coco Hu', followUpAction: 'Prepare a consolidated renewal calendar and usage review.', dueDate: '2026-07-15', decisionDate: '18 June 2026', decisionDateIso: '2026-06-18', source: 'Agenda', remindLead: false, remindFollowup: false },
];

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

function decisionArchiveThreshold(now: Date) {
  const threshold = new Date(melbourneDateSerial(now));
  threshold.setUTCMonth(threshold.getUTCMonth() - 2);
  return threshold.toISOString().slice(0, 10);
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

function Navigation({ activeView, backlogCount, decisionCount, onSelect }: { activeView: WorkspaceView; backlogCount: number; decisionCount: number; onSelect: (view: WorkspaceView) => void }) {
  return (
    <SidebarContent className="nav-content"><SidebarGroup className="nav-group"><SidebarGroupContent><SidebarMenu className="nav-menu">
      {[
        { label: 'Next meeting', icon: CalendarDays, view: 'meeting' as WorkspaceView },
        { label: 'Discussion backlog', icon: LayoutList, view: 'backlog' as WorkspaceView, count: backlogCount },
        { label: 'Decision log', icon: ClipboardCheck, view: 'decisions' as WorkspaceView, count: decisionCount },
        { label: 'Reminder settings', icon: Bell, view: 'reminders' as WorkspaceView },
      ].map(({ label, icon: Icon, view, count }) => <SidebarMenuItem key={label}><SidebarMenuButton isActive={activeView === view} className="nav-button" onClick={() => onSelect(view)}><Icon aria-hidden="true" /><span>{label}</span>{count ? <span className="nav-count">{count}</span> : null}</SidebarMenuButton></SidebarMenuItem>)}
    </SidebarMenu></SidebarGroupContent></SidebarGroup><div className="nav-foot"><span className="sample-dot" /><span>Interactive prototype</span></div></SidebarContent>
  );
}

export default function Home() {
  const [topics, setTopics] = React.useState(initialTopics);
  const [backlog, setBacklog] = React.useState(initialBacklog);
  const [historicalDecisions, setHistoricalDecisions] = React.useState(initialHistoricalDecisions);
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
  const [activeTopicTab, setActiveTopicTab] = React.useState('decision');
  const [search, setSearch] = React.useState('');
  const [decisionSearch, setDecisionSearch] = React.useState('');
  const [activeDecisionTab, setActiveDecisionTab] = React.useState<DecisionTab>('People & culture');
  const [decisionOwner, setDecisionOwner] = React.useState('All owners');
  const [now, setNow] = React.useState(() => new Date());

  const meetingSchedule = React.useMemo(() => buildMeetingSchedule(now), [now]);
  const meetingDateLong = new Intl.DateTimeFormat('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(meetingSchedule.nextMeetingSerial));
  const meetingDateIso = new Date(meetingSchedule.nextMeetingSerial).toISOString().slice(0, 10);
  const filteredTopics = topics.filter((topic) => fuzzyMatch(`${topic.title} ${topic.category} ${topic.lead}`, search));
  const archiveThreshold = React.useMemo(() => decisionArchiveThreshold(now), [now]);
  const recordedDecisions = [...topics, ...backlog, ...historicalDecisions].filter((topic) => topic.decision);
  const sortedDecisions = [...recordedDecisions].sort((a, b) => (b.decisionDateIso || '').localeCompare(a.decisionDateIso || ''));
  const activeDecisions = sortedDecisions.filter((topic) => !topic.decisionDateIso || topic.decisionDateIso >= archiveThreshold);
  const archivedDecisions = sortedDecisions.filter((topic) => Boolean(topic.decisionDateIso && topic.decisionDateIso < archiveThreshold));
  const hasDecisionSearch = Boolean(decisionSearch.trim());
  const searchedDecisions = sortedDecisions.filter((topic) => fuzzyMatch(`${topic.title} ${topic.category} ${topic.decision} ${topic.followUpOwner} ${topic.followUpAction} ${topic.source || ''} ${formatDecisionDate(topic.decisionDateIso, topic.decisionDate)}`, decisionSearch));
  const scopedDecisions = hasDecisionSearch
    ? searchedDecisions
    : activeDecisionTab === 'Archived'
      ? archivedDecisions
      : activeDecisions.filter((topic) => topic.category === activeDecisionTab);
  const visibleDecisions = decisionOwner === 'All owners'
    ? scopedDecisions
    : scopedDecisions.filter((topic) => topic.followUpOwner === decisionOwner);
  const decisionTabs: { label: DecisionTab; count: number }[] = [
    ...TOPIC_CATEGORIES.map((label) => ({ label, count: activeDecisions.filter((topic) => topic.category === label).length })),
    { label: 'Archived', count: archivedDecisions.length },
  ];
  const totalMinutes = topics.reduce((sum, topic) => sum + Number.parseInt(topic.time, 10), 0);

  React.useEffect(() => {
    const requestedView = new URLSearchParams(window.location.search).get('view');
    if (requestedView === 'people' || requestedView === 'summaries') { queueMicrotask(() => selectView('decisions')); return; }
    if (requestedView === 'meeting' || requestedView === 'backlog' || requestedView === 'decisions' || requestedView === 'reminders') queueMicrotask(() => setActiveView(requestedView));
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

  function openTopic(topic: Topic, tab = 'decision') {
    setSelectedTopic(topic); setActiveTopicTab(tab);
    setDecisionDraft({ decision: topic.decision, followUpOwner: topic.followUpOwner, followUpAction: topic.followUpAction, dueDate: topic.dueDate });
  }

  function updateTopic(updated: Topic) {
    setTopics((current) => current.map((topic) => topic.id === updated.id ? updated : topic));
    setBacklog((current) => current.map((topic) => topic.id === updated.id ? updated : topic));
    setHistoricalDecisions((current) => current.map((topic) => topic.id === updated.id ? updated : topic));
    setSelectedTopic(updated);
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

  return (
    <Toaster><div className="app-shell">
      <header className="brand-header"><div className="brand-lockup"><Image src="/assets/gms-logo-white.png" alt="GMS 10 Years" className="gms-logo" width={150} height={34} priority /><span className="brand-divider" aria-hidden="true" /><span className="product-name">Executive Projects</span></div><div className="header-actions"><Badge className="demo-badge">Interactive prototype</Badge><Button variant="ghost" className={`microsoft-button ${signedIn ? 'is-connected' : ''}`} onClick={() => setSignInOpen(true)}>{signedIn ? <Check aria-hidden="true" /> : <LogIn aria-hidden="true" />}<span>{signedIn ? 'Microsoft connected' : 'Sign in with Microsoft'}</span></Button></div></header>

      <SidebarProvider className="workspace-provider"><div className="workspace-layout"><Sidebar collapsible="none" className="workspace-sidebar"><Navigation activeView={activeView} backlogCount={backlog.length} decisionCount={recordedDecisions.length} onSelect={selectView} /></Sidebar><main className="workspace-main" id="workspace-main">
        <div className="mobile-topbar"><Button variant="outline" className="mobile-menu-button" aria-expanded={mobileNavOpen} aria-controls="mobile-navigation" onClick={() => setMobileNavOpen(true)}><Menu aria-hidden="true" />Menu</Button><Badge className="demo-badge mobile-demo">Prototype</Badge></div>

        {activeView === 'meeting' ? <><section className="meeting-intro" aria-labelledby="meeting-title"><div><p className="meeting-date">Biweekly · every second Monday</p><h1 id="meeting-title">Next executive meeting</h1></div><Button className="primary-action" size="lg" onClick={() => { setNewDestination('meeting'); setAddOpen(true); }}><Plus aria-hidden="true" />Add topic</Button></section>
          <section className="next-meeting-card" aria-label="Next executive meeting date"><div><span>Next executive meeting</span><strong>{meetingDateLong}</strong></div><Badge className="countdown-badge">{meetingSchedule.countdownDays === 0 ? 'Today' : `${meetingSchedule.countdownDays} days to go`}</Badge></section>
          <section className="agenda-panel" aria-labelledby="agenda-heading"><div className="panel-toolbar"><div><h2 id="agenda-heading">Next executive meeting agenda</h2><p>{topics.length} topics · {totalMinutes} minutes planned</p></div><label className="search-field" htmlFor="agenda-search"><Search aria-hidden="true" /><span className="sr-only">Search agenda</span><Input id="agenda-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search agenda" /></label></div><div className="agenda-list">
            {filteredTopics.map((topic, index) => <button type="button" className="agenda-row" key={topic.id} onClick={() => openTopic(topic)}><span className="agenda-order">{String(index + 1).padStart(2, '0')}</span><span className="agenda-summary"><span className="agenda-title">{topic.title}</span><span className="agenda-meta"><span className="topic-tag">{topic.category}</span><span>Proposed by {topic.lead}</span></span></span><span className="agenda-duration"><Clock3 aria-hidden="true" />{topic.time}</span><ChevronRight className="row-chevron" aria-hidden="true" /></button>)}
            {filteredTopics.length === 0 ? <div className="empty-state"><Search aria-hidden="true" /><strong>No matching topics</strong><span>Try another title, category or proposer.</span></div> : null}
          </div></section>
        </> : activeView === 'backlog' ? <section className="backlog-view" aria-labelledby="backlog-title"><div className="meeting-intro"><div><p className="meeting-date">Topics waiting for a future agenda</p><h1 id="backlog-title">Discussion backlog</h1><p className="intro-copy">Move a topic into the next meeting when it is ready for the EMT.</p></div><Button className="primary-action" size="lg" onClick={() => { setNewDestination('backlog'); setAddOpen(true); }}><Plus aria-hidden="true" />Add to backlog</Button></div><section className="agenda-panel backlog-panel"><div className="panel-toolbar"><div><h2>Waiting for discussion</h2><p>{backlog.length} prototype topics</p></div></div><div className="agenda-list">{backlog.map((topic, index) => <div className="backlog-row" key={topic.id}><button type="button" className="backlog-open" onClick={() => openTopic(topic)}><span className="agenda-order">{String(index + 1).padStart(2, '0')}</span><span className="agenda-summary"><span className="agenda-topline"><span className="agenda-title">{topic.title}</span><StatusBadge status={topic.status} /></span><span className="agenda-meta"><span className="topic-tag">{topic.category}</span><span>Proposed by {topic.lead}</span></span></span></button><Button variant="secondary" onClick={() => moveToAgenda(topic)}>Move to next meeting</Button></div>)}{backlog.length === 0 ? <div className="empty-state"><CheckCircle2 aria-hidden="true" /><strong>Backlog cleared</strong><span>Every discussion has been placed on an agenda.</span></div> : null}</div></section></section>
        : activeView === 'decisions' ? <section className="decisions-view" aria-labelledby="decisions-title"><div className="meeting-intro"><div><p className="meeting-date">Topic tabs · newest first</p><h1 id="decisions-title">Decision log</h1><p className="intro-copy">Open a topic tab to review its decisions, owners and follow-up actions. Anything older than two months moves to Archived automatically.</p></div></div><section className="decisions-panel" aria-labelledby="decision-log-title"><div className="panel-toolbar"><div><h2 id="decision-log-title">Recorded decisions</h2><p>{activeDecisions.length} current · {archivedDecisions.length} archived · date descending</p></div><label className="search-field decision-search" htmlFor="decision-search"><Search aria-hidden="true" /><span className="sr-only">Fuzzy search current and archived decisions</span><Input id="decision-search" value={decisionSearch} onChange={(event) => setDecisionSearch(event.target.value)} placeholder="Search current + archived" /></label></div><Tabs value={activeDecisionTab} onValueChange={(value) => setActiveDecisionTab(value as DecisionTab)} className="decision-tabs"><div className="decision-tab-scroll"><TabsList className="decision-tab-list" aria-label="Decision topics">{decisionTabs.map(({ label, count }) => <TabsTrigger value={label} className="decision-tab" key={label}>{label === 'Archived' ? <Archive aria-hidden="true" /> : null}<span>{label}</span><span className="decision-tab-count">{count}</span></TabsTrigger>)}</TabsList></div><TabsContent value={activeDecisionTab} className="decision-tab-panel"><div className="decision-view-head"><div><span className="decision-category">{hasDecisionSearch ? 'Search results' : activeDecisionTab}</span><p>{hasDecisionSearch ? `${visibleDecisions.length} matches across current and archived decisions` : activeDecisionTab === 'Archived' ? `Older than ${formatDecisionDate(archiveThreshold, undefined)} · still searchable and editable` : `${visibleDecisions.length} ${visibleDecisions.length === 1 ? 'decision' : 'decisions'} in this topic`}</p></div><div className="decision-view-actions"><label className="decision-owner-filter" htmlFor="decision-owner-filter"><span>Owner</span><NativeSelect id="decision-owner-filter" value={decisionOwner} onChange={(event) => setDecisionOwner(event.target.value)}><NativeSelectOption>All owners</NativeSelectOption>{EMT_MEMBERS.map((member) => <NativeSelectOption key={member}>{member}</NativeSelectOption>)}</NativeSelect></label>{hasDecisionSearch ? <Button variant="ghost" size="sm" onClick={() => setDecisionSearch('')}>Clear search</Button> : null}</div></div><div className="decision-list">{visibleDecisions.map((topic) => { const archived = Boolean(topic.decisionDateIso && topic.decisionDateIso < archiveThreshold); return <button type="button" className="decision-row" key={topic.id} onClick={() => openTopic(topic, 'decision')}><span className="decision-date">{formatDecisionDate(topic.decisionDateIso, topic.decisionDate)}<span className="decision-date-meta"><small>{topic.source || 'Agenda'}</small>{hasDecisionSearch ? <small className={archived ? 'archive-label' : 'current-label'}>{archived ? 'Archived' : topic.category}</small> : null}</span></span><span className="decision-summary"><span className="decision-topic">{topic.title}</span><span className="decision-copy">{topic.decision}</span></span><span className="decision-followup"><small>Next action</small><strong>{topic.followUpAction || 'Not added'}</strong><small>{topic.followUpOwner || 'Not assigned'} · Due {formatDueDate(topic.dueDate)}</small></span><ChevronRight className="row-chevron" aria-hidden="true" /></button>; })}{visibleDecisions.length === 0 ? <div className="empty-state">{activeDecisionTab === 'Archived' && !hasDecisionSearch ? <Archive aria-hidden="true" /> : <Search aria-hidden="true" />}<strong>{hasDecisionSearch ? 'No matching decisions' : activeDecisionTab === 'Archived' ? 'Nothing archived yet' : `No ${activeDecisionTab} decisions for ${decisionOwner}`}</strong><span>{hasDecisionSearch ? 'Try a title, topic, owner, date or part of a phrase.' : activeDecisionTab === 'Archived' ? 'Decisions move here automatically after two months.' : decisionOwner === 'All owners' ? 'Decisions will appear here after the meeting.' : 'Choose another owner or topic.'}</span></div> : null}</div></TabsContent></Tabs></section></section>
        : <section className="reminders-view" aria-labelledby="reminders-title"><div className="meeting-intro"><div><p className="meeting-date">Microsoft-connected follow-through</p><h1 id="reminders-title">Reminder settings</h1><p className="intro-copy">Define who is reminded, when it happens and which action the message refers to.</p></div></div><div className="settings-layout"><section className="settings-panel" aria-labelledby="reminder-rules-title"><div className="settings-section connection-section"><div><span className="icon-tile"><LogIn aria-hidden="true" /></span><div><h2>Microsoft connection</h2><p>{signedIn ? 'Connected in this prototype session' : 'Required for Outlook and calendar reminders'}</p></div></div><Button variant={signedIn ? 'outline' : 'default'} className={signedIn ? '' : 'primary-action'} onClick={() => setSignInOpen(true)}>{signedIn ? <><Check aria-hidden="true" />Connected</> : 'Connect Microsoft'}</Button></div><div className="settings-section global-setting"><div><h2 id="reminder-rules-title">Automatic reminders</h2><p>Apply the rules below to topic proposers and follow-up owners.</p></div><Switch checked={signedIn && remindersOn} disabled={!signedIn} onCheckedChange={setRemindersOn} aria-label="Automatic reminders" /></div><div className="settings-section reminder-rules"><div className="setting-row"><div className="rule-copy"><Bell aria-hidden="true" /><span><strong>Agenda proposer reminder</strong><small>Ask the topic proposer to prepare input before the meeting.</small></span></div><NativeSelect value={agendaReminderTiming} onChange={(event) => setAgendaReminderTiming(event.target.value)} disabled={!signedIn || !remindersOn}><NativeSelectOption>1 business day before</NativeSelectOption><NativeSelectOption>2 business days before</NativeSelectOption><NativeSelectOption>3 business days before</NativeSelectOption></NativeSelect></div><div className="setting-row"><div className="rule-copy"><ClipboardCheck aria-hidden="true" /><span><strong>Follow-up reminder</strong><small>Remind the named owner before an agreed action is due.</small></span></div><NativeSelect value={followupReminderTiming} onChange={(event) => setFollowupReminderTiming(event.target.value)} disabled={!signedIn || !remindersOn}><NativeSelectOption>On the due date</NativeSelectOption><NativeSelectOption>1 business day before</NativeSelectOption><NativeSelectOption>2 business days before</NativeSelectOption></NativeSelect></div><div className="setting-row"><div className="rule-copy"><CircleAlert aria-hidden="true" /><span><strong>Overdue follow-up</strong><small>Send a weekday nudge until the owner marks the action complete.</small></span></div><Switch checked={overdueRemindersOn} onCheckedChange={setOverdueRemindersOn} disabled={!signedIn || !remindersOn} aria-label="Overdue follow-up reminders" /></div><div className="setting-row"><div className="rule-copy"><CalendarDays aria-hidden="true" /><span><strong>Business days only</strong><small>Do not send reminders on weekends. Time zone: Australia/Melbourne.</small></span></div><Switch checked={businessDaysOnly} onCheckedChange={setBusinessDaysOnly} disabled={!signedIn || !remindersOn} aria-label="Business days only" /></div></div></section><aside className="reminder-preview" aria-labelledby="preview-reminders-title"><div className="preview-head"><span className="icon-tile"><Mail aria-hidden="true" /></span><div><h2 id="preview-reminders-title">Next scheduled reminders</h2><p>Preview of the messages that would be prepared.</p></div></div><div className="recipient-strip"><span>Recipients</span><strong>Topic proposers · Follow-up owners</strong></div><div className="preview-list"><article className="preview-message"><span className="preview-time">2 business days before</span><strong>George — input needed for contract signing authority</strong><p>Bring the current thresholds and flagged policy gaps to the next meeting.</p></article><article className="preview-message"><span className="preview-time">1 business day before due</span><strong>Brenda — leave coverage action approaching</strong><p>Set up the shared coverage calendar and circulate the handover template.</p></article></div><p className="mock-note">Simulation only — no email or calendar event will be created.</p></aside></div></section>}
      </main></div></SidebarProvider>

      <Dialog open={addOpen} onOpenChange={setAddOpen}><DialogContent className="form-dialog"><form onSubmit={addTopic}><DialogHeader><DialogTitle>Add a discussion topic</DialogTitle><DialogDescription>Capture what the EMT should discuss and who proposed it.</DialogDescription></DialogHeader><div className="form-stack"><label htmlFor="discussion-title"><span>Topic title</span><Input id="discussion-title" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="What needs discussion or a decision?" required /></label><label htmlFor="discussion-destination"><span>Destination</span><NativeSelect id="discussion-destination" value={newDestination} onChange={(event) => setNewDestination(event.target.value as WorkspaceView)}><NativeSelectOption value="meeting">Next executive meeting</NativeSelectOption><NativeSelectOption value="backlog">Discussion backlog</NativeSelectOption></NativeSelect></label><div className="form-pair"><label htmlFor="discussion-category"><span>Topic</span><NativeSelect id="discussion-category" value={newCategory} onChange={(event) => setNewCategory(event.target.value)}>{TOPIC_CATEGORIES.map((category) => <NativeSelectOption key={category}>{category}</NativeSelectOption>)}</NativeSelect></label><label htmlFor="discussion-lead"><span>Proposed by</span><NativeSelect id="discussion-lead" value={newLead} onChange={(event) => setNewLead(event.target.value)}>{EMT_MEMBERS.map((member) => <NativeSelectOption key={member}>{member}</NativeSelectOption>)}</NativeSelect></label></div><label htmlFor="discussion-context"><span>Context for the meeting</span><Textarea id="discussion-context" value={newContext} onChange={(event) => setNewContext(event.target.value)} placeholder="Add the decision needed, useful links or preparation notes." /></label></div><DialogFooter><DialogClose render={<Button variant="ghost" type="button" />}>Cancel</DialogClose><Button type="submit" className="primary-action">Add topic</Button></DialogFooter></form></DialogContent></Dialog>

      <Dialog open={signInOpen} onOpenChange={setSignInOpen}><DialogContent className="signin-dialog"><DialogHeader><span className="signin-icon"><LogIn aria-hidden="true" /></span><DialogTitle>{signedIn ? 'Microsoft connection' : 'Connect your Microsoft account'}</DialogTitle><DialogDescription>{signedIn ? 'This prototype account shows how the live connection could be managed.' : 'The live product would request permission to sign you in and prepare Outlook reminders and calendar context.'}</DialogDescription></DialogHeader><div className="permission-list"><div><UserRound aria-hidden="true" /><span><strong>Basic profile</strong><small>Identify you inside the executive workspace</small></span></div><div><Mail aria-hidden="true" /><span><strong>Outlook mail</strong><small>Prepare reminder messages for assigned people</small></span></div><div><CalendarDays aria-hidden="true" /><span><strong>Calendar</strong><small>Connect the fortnightly meeting and due dates</small></span></div></div><p className="mock-note">This is a safe simulation. No Microsoft sign-in will open and no permissions are requested.</p><DialogFooter><DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose><Button className="primary-action" onClick={simulateSignIn}>{signedIn ? 'Done' : 'Simulate Microsoft sign-in'}</Button></DialogFooter></DialogContent></Dialog>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}><SheetContent side="left" id="mobile-navigation" className="mobile-nav-sheet"><SheetHeader><SheetTitle>Executive Projects</SheetTitle><SheetDescription>Workspace navigation</SheetDescription></SheetHeader><Navigation activeView={activeView} backlogCount={backlog.length} decisionCount={recordedDecisions.length} onSelect={(view) => { selectView(view); setMobileNavOpen(false); }} /></SheetContent></Sheet>

      <Sheet open={Boolean(selectedTopic)} onOpenChange={(open) => !open && setSelectedTopic(null)}><SheetContent className="topic-sheet">{selectedTopic ? <><div className="topic-sheet-header"><Badge className="topic-category">{selectedTopic.category}</Badge><SheetHeader><SheetTitle>{selectedTopic.title}</SheetTitle><SheetDescription>Decision and reminder record · editable prototype</SheetDescription></SheetHeader></div><Tabs value={activeTopicTab} onValueChange={setActiveTopicTab} className="topic-tabs"><TabsList className="topic-tab-list"><TabsTrigger value="decision">Decision</TabsTrigger><TabsTrigger value="reminders">Reminders</TabsTrigger></TabsList><TabsContent value="decision" className="tab-panel"><div className="decision-placeholder"><MessageSquareText aria-hidden="true" /><h3>Review and edit the decision</h3><p>Keep what was agreed, the owner, next action and due date in one editable record.</p>{selectedTopic.decision ? <div className="saved-decision"><strong>Current decision</strong><span>{selectedTopic.decision}</span><small>Next action: {selectedTopic.followUpAction || 'Not added'}</small><small>Owner: {selectedTopic.followUpOwner || 'Not assigned'} · Due: {formatDueDate(selectedTopic.dueDate)}</small></div> : null}<label className="decision-field" htmlFor="decision-rationale"><span>Decision and rationale</span><Textarea id="decision-rationale" value={decisionDraft.decision} onChange={(event) => setDecisionDraft((draft) => ({ ...draft, decision: event.target.value }))} placeholder="What was agreed?" /></label><label className="decision-field" htmlFor="decision-action"><span>Next action</span><Input id="decision-action" value={decisionDraft.followUpAction} onChange={(event) => setDecisionDraft((draft) => ({ ...draft, followUpAction: event.target.value }))} placeholder="What needs to happen next?" /></label><div className="form-pair"><label className="decision-field" htmlFor="decision-owner"><span>Follow-up owner</span><NativeSelect id="decision-owner" value={decisionDraft.followUpOwner} onChange={(event) => setDecisionDraft((draft) => ({ ...draft, followUpOwner: event.target.value }))}><NativeSelectOption value="">Not assigned</NativeSelectOption>{EMT_MEMBERS.map((member) => <NativeSelectOption key={member}>{member}</NativeSelectOption>)}</NativeSelect></label><label className="decision-field" htmlFor="decision-due-date"><span>Due date</span><Input id="decision-due-date" value={decisionDraft.dueDate} onChange={(event) => setDecisionDraft((draft) => ({ ...draft, dueDate: event.target.value }))} type="date" /></label></div><Button className="primary-action" onClick={saveDecision}><Check aria-hidden="true" />Save decision</Button></div></TabsContent><TabsContent value="reminders" className="tab-panel"><div className="reminder-setting-row"><div><Bell aria-hidden="true" /><span><strong>Proposer reminder</strong><small>{signedIn && remindersOn ? 'Send before the meeting' : signedIn ? 'Automatic reminders are paused' : 'Connect Microsoft to activate'}</small></span></div><Switch checked={signedIn && remindersOn && selectedTopic.remindLead} disabled={!signedIn || !remindersOn} onCheckedChange={(checked) => updateTopic({ ...selectedTopic, remindLead: checked })} aria-label="Proposer reminder" /></div><div className="reminder-setting-row"><div><ClipboardCheck aria-hidden="true" /><span><strong>Follow-up reminder</strong><small>{signedIn && remindersOn ? 'Send before the action due date' : signedIn ? 'Automatic reminders are paused' : 'Connect Microsoft to activate'}</small></span></div><Switch checked={signedIn && remindersOn && selectedTopic.remindFollowup} disabled={!signedIn || !remindersOn} onCheckedChange={(checked) => updateTopic({ ...selectedTopic, remindFollowup: checked })} aria-label="Follow-up reminder" /></div><div className="integration-callout"><Sparkles aria-hidden="true" /><p><strong>{signedIn ? 'Microsoft Graph connected' : 'Microsoft Graph connection needed'}</strong><span>{signedIn ? remindersOn ? 'Reminder preferences are active in this prototype session.' : 'The Microsoft connection is ready, but automatic reminders are paused.' : 'The production version would request delegated work-account permissions under your organisation’s security policy.'}</span></p></div></TabsContent></Tabs></> : null}</SheetContent></Sheet>
    </div></Toaster>
  );
}
