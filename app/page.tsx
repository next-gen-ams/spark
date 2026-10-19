'use client';

import * as React from 'react';
import Image from '@/lib/brand-image';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'motion/react';
import {
  Archive,
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  LayoutList,
  LoaderCircle,
  LogIn,
  LogOut,
  Mail,
  Menu,
  MessageSquareText,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { FollowUpStatus } from '@/components/follow-up-status';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@/components/ui/sidebar';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Toaster, toast } from '@/components/ui/toast';
import { motionTokens, springs } from '@/lib/motion-tokens';
import {
  connectMicrosoft,
  disconnectMicrosoft,
  microsoftAuthConfigured,
  restoreMicrosoftSession,
  type MicrosoftProfile,
} from '@/lib/microsoft-auth';
import { isMicrosoftReauthenticationRequired } from '@/lib/microsoft-auth-policy';
import {
  createEmtCategory,
  createEmtTopic,
  deleteEmtCategory,
  deleteEmtDecision,
  deleteEmtTopic,
  loadEmtWorkspace,
  renameEmtCategory,
  saveEmtSettings,
  saveEmtTopic,
  setEmtCompletion,
  type WorkspaceCategory,
  type WorkspaceMember,
  type WorkspaceSettings,
  type WorkspaceTopic as Topic,
} from '@/lib/emt-api';
import {
  buildMeetingSchedule,
  meetingDateLong,
  MELBOURNE_TIME_ZONE,
} from '@/lib/meeting-schedule';

type WorkspaceView =
  | 'meeting'
  | 'backlog'
  | 'decisions'
  | 'topics'
  | 'reminders';
type DecisionTab = string;
type MicrosoftStatus =
  | 'loading'
  | 'unconfigured'
  | 'disconnected'
  | 'connected'
  | 'error';
type PendingMutation =
  | 'add-discussion'
  | 'add-category'
  | 'delete-category'
  | 'delete-decision'
  | 'delete-discussion'
  | 'move-topic'
  | 'save-decision'
  | 'save-topic'
  | 'set-completion'
  | null;

const DEFAULT_TOPIC_CATEGORIES = [
  'People & culture',
  'Operations',
  'Governance',
  'Finance',
];
const initialCategories: WorkspaceCategory[] = DEFAULT_TOPIC_CATEGORIES.map(
  (name, index) => ({
    id: index + 1,
    name,
    sortOrder: (index + 1) * 10,
    active: true,
    system: false,
    usageCount: 0,
  }),
);
const APP_BASE_PATH = process.env.NEXT_PUBLIC_APP_BASE_PATH ?? '';

const initialTopics: Topic[] = [
  {
    id: 1,
    bucket: 'agenda',
    title: 'Confirm Q4 all-hands owners and format',
    category: 'People & culture',
    status: 'Scheduled',
    lead: 'Lisa Xu',
    leadInitials: 'LX',
    time: '10 min',
    note: 'Agree the host, business updates and questions format before the October invitation is drafted.',
    prepAction: 'Bring the proposed host and three business update owners.',
    decision:
      'Run a 45-minute all-hands with one host, three business updates and a moderated team Q&A.',
    followUpOwner: 'Lisa Xu',
    followUpAction:
      'Draft the October all-hands invitation and confirm the three business update owners.',
    dueDate: '2026-09-22',
    decisionDate: '3 September 2026',
    decisionDateIso: '2026-09-03',
    meetingDate: '2026-09-28',
    source: 'Agenda',
  },
  {
    id: 2,
    bucket: 'agenda',
    title: 'Review contract signing authority',
    category: 'Governance',
    status: 'Needs input',
    lead: 'George Pesutto',
    leadInitials: 'GP',
    time: '15 min',
    note: 'Review current thresholds and decide whether the operating policy needs a 2026 update.',
    prepAction:
      'Bring the current signing thresholds and flagged policy gaps to the meeting.',
    decision: '',
    followUpOwner: '',
    followUpAction: '',
    dueDate: '',
    meetingDate: '2026-09-28',
    source: 'Agenda',
  },
  {
    id: 3,
    bucket: 'agenda',
    title: 'Executive offsite planning approach',
    category: 'Operations',
    status: 'Needs input',
    lead: 'Coco Hu',
    leadInitials: 'CH',
    time: '8 min',
    note: 'Agree who will return with timing, location options and a proposed working agenda.',
    prepAction: 'Bring timing, location options and a draft working agenda.',
    decision: '',
    followUpOwner: '',
    followUpAction: '',
    dueDate: '',
    meetingDate: '2026-09-28',
    source: 'Agenda',
  },
  {
    id: 4,
    bucket: 'agenda',
    title: 'Approve shared leave coverage process',
    category: 'Operations',
    status: 'Scheduled',
    lead: 'Brenda Cugley',
    leadInitials: 'BC',
    time: '7 min',
    note: 'Confirm the minimum handover information and who owns the shared coverage calendar.',
    prepAction: 'Bring the draft handover template for a final check.',
    decision:
      'Use one shared coverage calendar and require a named backup plus a short handover note for leave longer than two days.',
    followUpOwner: 'Brenda Cugley',
    followUpAction:
      'Set up the shared coverage calendar and circulate the handover template.',
    dueDate: '2026-09-18',
    decisionDate: '20 August 2026',
    decisionDateIso: '2026-08-20',
    meetingDate: '2026-09-28',
    source: 'Agenda',
  },
];

const initialBacklog: Topic[] = [
  {
    id: 101,
    bucket: 'backlog',
    title: 'Clarify quarterly recognition budget',
    category: 'Finance',
    status: 'Needs input',
    lead: 'Lisa Xu',
    leadInitials: 'LX',
    time: '10 min',
    note: 'Confirm the budget information needed before this moves to a meeting.',
    prepAction: 'Identify the budget input needed.',
    decision: '',
    followUpOwner: '',
    followUpAction: '',
    dueDate: '',
    source: 'Agenda',
  },
  {
    id: 102,
    bucket: 'backlog',
    title: 'Review after-hours office access policy',
    category: 'Operations',
    status: 'Scheduled',
    lead: 'Coco Hu',
    leadInitials: 'CH',
    time: '10 min',
    note: 'Review whether the current process still matches the team’s operating pattern.',
    prepAction: 'Bring the current access process and recent exceptions.',
    decision: '',
    followUpOwner: '',
    followUpAction: '',
    dueDate: '',
    source: 'Agenda',
  },
];

const initialHistoricalDecisions: Topic[] = [
  {
    id: 201,
    bucket: 'history',
    title: 'Approve FY27 software subscription budget',
    category: 'Finance',
    status: 'Scheduled',
    lead: 'George Pesutto',
    leadInitials: 'GP',
    time: '12 min',
    note: 'Review core subscriptions and the evidence needed for any plan upgrades.',
    prepAction: '',
    decision:
      'Keep core tools on standard plans and review upgrade requests against measured team usage.',
    followUpOwner: 'Coco Hu',
    followUpAction: 'Prepare a consolidated renewal calendar and usage review.',
    dueDate: '2026-07-15',
    decisionDate: '18 June 2026',
    decisionDateIso: '2026-06-18',
    source: 'Agenda',
  },
];

function formatDueDate(value: string) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatDecisionDate(
  value: string | undefined,
  fallback: string | undefined,
) {
  if (!value) return fallback || 'Date not set';
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s&]/g, ' ');
}

function profileInitials(displayName: string) {
  return (
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'GMS'
  );
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
  return needle
    .split(/\s+/)
    .filter(Boolean)
    .every((queryWord) =>
      words.some((word) => {
        if (word.includes(queryWord)) return true;
        if (queryWord.length < 4 || word.length < 4) return false;
        if (queryWord.includes(word)) return true;
        return editDistance(word, queryWord) <= (queryWord.length >= 8 ? 2 : 1);
      }),
    );
}

const DEFAULT_MEETING_ANCHOR = '2026-09-14';

function melbourneDateSerial(date: Date) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: MELBOURNE_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date);
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return Date.UTC(
    Number(value.year),
    Number(value.month) - 1,
    Number(value.day),
  );
}

function decisionArchiveThreshold(now: Date) {
  const threshold = new Date(melbourneDateSerial(now));
  threshold.setUTCMonth(threshold.getUTCMonth() - 2);
  return threshold.toISOString().slice(0, 10);
}

function Navigation({
  activeView,
  backlogCount,
  decisionCount,
  onSelect,
}: {
  activeView: WorkspaceView;
  backlogCount: number;
  decisionCount: number;
  onSelect: (view: WorkspaceView) => void;
}) {
  return (
    <SidebarContent className="nav-content">
      <SidebarGroup className="nav-group">
        <SidebarGroupContent>
          <SidebarMenu className="nav-menu">
            {[
              {
                label: 'Next meeting',
                icon: CalendarDays,
                view: 'meeting' as WorkspaceView,
              },
              {
                label: 'Discussion backlog',
                icon: LayoutList,
                view: 'backlog' as WorkspaceView,
                count: backlogCount,
              },
              {
                label: 'Decision log',
                icon: ClipboardCheck,
                view: 'decisions' as WorkspaceView,
                count: decisionCount,
              },
              {
                label: 'Topic settings',
                icon: Settings2,
                view: 'topics' as WorkspaceView,
              },
              {
                label: 'Reminder settings',
                icon: Bell,
                view: 'reminders' as WorkspaceView,
              },
            ].map(({ label, icon: Icon, view, count }) => (
              <SidebarMenuItem key={label}>
                <SidebarMenuButton
                  isActive={activeView === view}
                  className="nav-button"
                  onClick={() => onSelect(view)}
                >
                  <Icon aria-hidden="true" />
                  <span>{label}</span>
                  {count ? <span className="nav-count">{count}</span> : null}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  );
}

function MicrosoftMark() {
  return (
    <span className="microsoft-mark" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

function WorkspaceRestoring({ profile }: { profile: MicrosoftProfile | null }) {
  return (
    <main className="workspace-restoring" aria-busy="true">
      <header className="brand-header">
        <div className="brand-lockup">
          <Image
            src={`${APP_BASE_PATH}/assets/gms-logo-white.png`}
            alt="GMS 10 Years"
            className="gms-logo"
            width={150}
            height={34}
            priority
          />
          <span className="brand-divider" aria-hidden="true" />
          <span className="product-name">EMT Tracker</span>
        </div>
        {profile ? (
          <div className="restoring-profile">
            <Avatar size="sm">
              <AvatarFallback>
                {profileInitials(profile.displayName)}
              </AvatarFallback>
            </Avatar>
            <span>{profile.displayName}</span>
          </div>
        ) : null}
      </header>
      <section className="restoring-stage" aria-live="polite">
        <div className="restoring-sidebar" aria-hidden="true" />
        <div className="restoring-content">
          <div className="restoring-kicker" />
          <div className="restoring-title" />
          <div className="restoring-meeting-card" />
          <div className="restoring-agenda-card" />
          <output className="restoring-status">
            <LoaderCircle className="spin" aria-hidden="true" />
            Restoring your secure workspace
          </output>
        </div>
      </section>
    </main>
  );
}

function AccessGate({
  microsoftStatus,
  microsoftProfile,
  microsoftError,
  workspaceStatus,
  workspaceError,
  onSignIn,
  onRetryWorkspace,
  onSignOut,
}: {
  microsoftStatus: MicrosoftStatus;
  microsoftProfile: MicrosoftProfile | null;
  microsoftError: string;
  workspaceStatus: 'idle' | 'loading' | 'ready' | 'saving' | 'error';
  workspaceError: string;
  onSignIn: () => void;
  onRetryWorkspace: () => void;
  onSignOut: () => void;
}) {
  const signedIn = microsoftStatus === 'connected';
  const checking =
    microsoftStatus === 'loading' || (signedIn && workspaceStatus !== 'error');
  const setupMissing = microsoftStatus === 'unconfigured';
  const workspaceBlocked = signedIn && workspaceStatus === 'error';
  const authFailed = microsoftStatus === 'error';

  const title = checking
    ? 'Checking your Microsoft account'
    : workspaceBlocked
      ? 'We could not open the EMT workspace'
      : authFailed
        ? 'Your Microsoft session needs reconnecting'
        : setupMissing
          ? 'Microsoft sign-in is not configured'
          : 'Sign in to EMT Tracker';
  const description = checking
    ? 'Verifying your GMS profile and EMT access.'
    : workspaceBlocked
      ? workspaceError ||
        'Your Microsoft profile is connected, but shared workspace access could not be verified.'
      : authFailed
        ? microsoftError ||
          'Please try signing in again with your GMS work account.'
        : setupMissing
          ? 'The Microsoft Entra application details need to be added before this workspace can be opened.'
          : 'Use your GMS Microsoft account to access the executive meeting workspace.';

  return (
    <main className="access-gate">
      <section className="access-stage" aria-labelledby="access-title">
        <div className="access-panel">
          <div className="access-panel-brand">
            <Image
              src={`${APP_BASE_PATH}/assets/gms-logo-white.png`}
              alt="GMS 10 Years"
              className="gms-logo"
              width={150}
              height={34}
              priority
            />
            <span className="brand-divider" aria-hidden="true" />
            <span className="product-name">EMT Tracker</span>
          </div>
          <div className="access-panel-body">
            <div className="access-panel-icon">
              <MicrosoftMark />
            </div>
            <div className="access-panel-copy">
              <h1 id="access-title">{title}</h1>
              <p>{description}</p>
            </div>
            {microsoftProfile && (workspaceBlocked || authFailed) ? (
              <div className="access-account">
                <Avatar>
                  <AvatarFallback>
                    {profileInitials(microsoftProfile.displayName)}
                  </AvatarFallback>
                </Avatar>
                <span>
                  <strong>{microsoftProfile.displayName}</strong>
                  <small>{microsoftProfile.email}</small>
                </span>
              </div>
            ) : null}
            {checking ? (
              <output className="access-progress">
                <LoaderCircle className="spin" aria-hidden="true" />
                <span>Secure connection in progress</span>
              </output>
            ) : null}
            {!checking && !setupMissing ? (
              <Button
                className="access-primary"
                size="lg"
                onClick={workspaceBlocked ? onRetryWorkspace : onSignIn}
              >
                <MicrosoftMark />
                <span>
                  {workspaceBlocked
                    ? 'Try workspace again'
                    : authFailed
                      ? 'Reconnect Microsoft'
                      : 'Continue with Microsoft'}
                </span>
                <ArrowRight aria-hidden="true" />
              </Button>
            ) : null}
            {setupMissing ? (
              <output className="access-configuration">
                <CircleAlert aria-hidden="true" />
                <span>
                  Ask the project administrator to complete the Microsoft Entra
                  setup.
                </span>
              </output>
            ) : null}
            {microsoftProfile && (workspaceBlocked || authFailed) ? (
              <Button
                variant="ghost"
                className="access-signout"
                onClick={onSignOut}
              >
                <LogOut aria-hidden="true" />
                Sign out and use another account
              </Button>
            ) : null}
            <div className="access-assurance">
              <ShieldCheck aria-hidden="true" />
              <span>
                <strong>Protected by Microsoft</strong>
                <small>
                  Basic profile only. Reminder sending uses separate
                  admin-managed authorisation.
                </small>
              </span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function Home() {
  const [topics, setTopics] = React.useState(initialTopics);
  const [backlog, setBacklog] = React.useState(initialBacklog);
  const [historicalDecisions, setHistoricalDecisions] = React.useState(
    initialHistoricalDecisions,
  );
  const [categories, setCategories] =
    React.useState<WorkspaceCategory[]>(initialCategories);
  const [members, setMembers] = React.useState<WorkspaceMember[]>([]);
  const [categoryDrafts, setCategoryDrafts] = React.useState<
    Record<number, string>
  >(() =>
    Object.fromEntries(
      initialCategories.map((category) => [category.id, category.name]),
    ),
  );
  const [newTopicCategory, setNewTopicCategory] = React.useState('');
  const [categoryPendingDelete, setCategoryPendingDelete] =
    React.useState<WorkspaceCategory | null>(null);
  const [discussionPendingDelete, setDiscussionPendingDelete] =
    React.useState<Topic | null>(null);
  const [decisionPendingDelete, setDecisionPendingDelete] =
    React.useState<Topic | null>(null);
  const [pendingMutation, setPendingMutation] =
    React.useState<PendingMutation>(null);
  const mutationLockRef = React.useRef(false);
  const [activeView, setActiveView] = React.useState<WorkspaceView>('meeting');
  const [selectedTopic, setSelectedTopic] = React.useState<Topic | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [signInOpen, setSignInOpen] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [microsoftStatus, setMicrosoftStatus] = React.useState<MicrosoftStatus>(
    microsoftAuthConfigured ? 'loading' : 'unconfigured',
  );
  const [microsoftProfile, setMicrosoftProfile] =
    React.useState<MicrosoftProfile | null>(null);
  const [microsoftError, setMicrosoftError] = React.useState('');
  const [workspaceStatus, setWorkspaceStatus] = React.useState<
    'idle' | 'loading' | 'ready' | 'saving' | 'error'
  >('idle');
  const [workspaceError, setWorkspaceError] = React.useState('');
  const [workspaceVerified, setWorkspaceVerified] = React.useState(false);
  const [workspaceLoadAttempt, setWorkspaceLoadAttempt] = React.useState(0);
  const [remindersOn, setRemindersOn] = React.useState(true);
  const [agendaReminderTiming, setAgendaReminderTiming] = React.useState(
    '2 business days before',
  );
  const [followupReminderTiming, setFollowupReminderTiming] = React.useState(
    '1 business day before',
  );
  const [overdueRemindersOn, setOverdueRemindersOn] = React.useState(true);
  const [businessDaysOnly, setBusinessDaysOnly] = React.useState(true);
  const [newTitle, setNewTitle] = React.useState('');
  const [newCategory, setNewCategory] = React.useState('Operations');
  const [newLead, setNewLead] = React.useState('');
  const [newContext, setNewContext] = React.useState('');
  const [newDestination, setNewDestination] =
    React.useState<WorkspaceView>('meeting');
  const [meetingAnchorDate, setMeetingAnchorDate] = React.useState(
    DEFAULT_MEETING_ANCHOR,
  );
  const [activeMeetingDate, setActiveMeetingDate] = React.useState('');
  const [newMeetingDate, setNewMeetingDate] = React.useState('');
  const [draggedTopicId, setDraggedTopicId] = React.useState<number | null>(
    null,
  );
  const [dragTargetDate, setDragTargetDate] = React.useState('');
  const pointerDragRef = React.useRef<{
    pointerId: number;
    topicId: number;
    startX: number;
    startY: number;
    dragging: boolean;
  } | null>(null);
  const dragTargetDateRef = React.useRef('');
  const suppressTopicOpenRef = React.useRef(false);
  const dragPreviewLockedRef = React.useRef(false);
  const dragPreviewX = useMotionValue(-400);
  const dragPreviewY = useMotionValue(-400);
  const dragPreviewSpringX = useSpring(dragPreviewX, springs.snappy);
  const dragPreviewSpringY = useSpring(dragPreviewY, springs.snappy);
  const prefersReducedMotion = useReducedMotion();
  const [activeTopicTab, setActiveTopicTab] = React.useState('topic');
  const [topicDraft, setTopicDraft] = React.useState({
    title: '',
    category: 'Operations',
    lead: '',
    note: '',
    destination: 'backlog',
  });
  const [decisionDraft, setDecisionDraft] = React.useState({
    decision: '',
    followUpOwner: '',
    followUpAction: '',
    dueDate: '',
  });
  const [search, setSearch] = React.useState('');
  const [decisionSearch, setDecisionSearch] = React.useState('');
  const [activeDecisionTab, setActiveDecisionTab] =
    React.useState<DecisionTab>('People & culture');
  const [decisionOwner, setDecisionOwner] = React.useState('All owners');
  const [now, setNow] = React.useState(() => new Date());

  const positionTopicDragPreview = React.useCallback(
    (clientX: number, clientY: number) => {
      if (
        typeof window === 'undefined' ||
        (clientX === 0 && clientY === 0) ||
        (prefersReducedMotion && dragPreviewLockedRef.current)
      ) {
        return;
      }

      const previewWidth = 286;
      const previewHeight = 96;
      const inset = motionTokens.distance.md;
      const nextX = Math.min(
        Math.max(inset, clientX + inset),
        Math.max(inset, window.innerWidth - previewWidth - inset),
      );
      const nextY = Math.min(
        Math.max(inset, clientY + inset),
        Math.max(inset, window.innerHeight - previewHeight - inset),
      );

      dragPreviewX.set(nextX);
      dragPreviewY.set(nextY);
      if (prefersReducedMotion) dragPreviewLockedRef.current = true;
    },
    [dragPreviewX, dragPreviewY, prefersReducedMotion],
  );

  function beginMutation(action: Exclude<PendingMutation, null>) {
    if (mutationLockRef.current) return false;
    mutationLockRef.current = true;
    setPendingMutation(action);
    return true;
  }

  function finishMutation() {
    mutationLockRef.current = false;
    setPendingMutation(null);
  }

  const meetingSchedule = React.useMemo(
    () => buildMeetingSchedule(now, meetingAnchorDate),
    [meetingAnchorDate, now],
  );
  const selectedMeetingDate =
    activeMeetingDate || meetingSchedule[0]?.iso || '';
  const selectedMeeting =
    meetingSchedule.find((meeting) => meeting.iso === selectedMeetingDate) ||
    meetingSchedule[0];
  const selectedMeetingTopics = topics.filter(
    (topic) => topic.meetingDate === selectedMeetingDate,
  );
  const filteredTopics = selectedMeetingTopics.filter((topic) =>
    fuzzyMatch(`${topic.title} ${topic.category} ${topic.lead}`, search),
  );
  const draggedTopic =
    draggedTopicId === null
      ? null
      : topics.find((topic) => topic.id === draggedTopicId) || null;
  const archiveThreshold = React.useMemo(
    () => decisionArchiveThreshold(now),
    [now],
  );
  const workspaceTopics = [...topics, ...backlog, ...historicalDecisions];
  const recordedDecisions = workspaceTopics.filter((topic) => topic.decision);
  const sortedDecisions = [...recordedDecisions].sort((a, b) =>
    (b.decisionDateIso || '').localeCompare(a.decisionDateIso || ''),
  );
  const activeDecisions = sortedDecisions.filter(
    (topic) =>
      !topic.decisionDateIso || topic.decisionDateIso >= archiveThreshold,
  );
  const archivedDecisions = sortedDecisions.filter((topic) =>
    Boolean(topic.decisionDateIso && topic.decisionDateIso < archiveThreshold),
  );
  const hasDecisionSearch = Boolean(decisionSearch.trim());
  const searchedDecisions = sortedDecisions.filter((topic) =>
    fuzzyMatch(
      `${topic.title} ${topic.category} ${topic.decision} ${topic.followUpOwner} ${topic.followUpAction} ${topic.source || ''} ${formatDecisionDate(topic.decisionDateIso, topic.decisionDate)}`,
      decisionSearch,
    ),
  );
  const scopedDecisions = hasDecisionSearch
    ? searchedDecisions
    : activeDecisionTab === 'Archived'
      ? archivedDecisions
      : activeDecisions.filter((topic) => topic.category === activeDecisionTab);
  const visibleDecisions =
    decisionOwner === 'All owners'
      ? scopedDecisions
      : scopedDecisions.filter(
          (topic) => topic.followUpOwner === decisionOwner,
        );
  const decisionCategoryNames = categories
    .filter((category) => category.active && !category.system)
    .map((category) => category.name);
  for (const category of activeDecisions.map((topic) => topic.category))
    if (!decisionCategoryNames.includes(category))
      decisionCategoryNames.push(category);
  const decisionTabs: { label: DecisionTab; count: number }[] = [
    ...decisionCategoryNames.map((label) => ({
      label,
      count: activeDecisions.filter((topic) => topic.category === label).length,
    })),
    { label: 'Archived', count: archivedDecisions.length },
  ];
  const signedIn = microsoftStatus === 'connected';
  const currentMember = members.find(
    (member) =>
      member.email.toLowerCase() ===
      (microsoftProfile?.email || '').toLowerCase(),
  );
  const personalReminders =
    remindersOn && currentMember
      ? [
          ...topics
            .filter(
              (topic) =>
                !topic.completedAt && topic.lead === currentMember.displayName,
            )
            .map((topic) => ({
              id: `agenda-${topic.id}`,
              timing: agendaReminderTiming,
              title: topic.title,
              detail: topic.prepAction || topic.note,
            })),
          ...recordedDecisions
            .filter(
              (topic) =>
                topic.followUpOwner === currentMember.displayName &&
                !topic.completedAt &&
                topic.followUpAction &&
                topic.dueDate,
            )
            .map((topic) => ({
              id: `followup-${topic.id}`,
              timing: `${followupReminderTiming}${topic.dueDate ? ` · due ${formatDueDate(topic.dueDate)}` : ''}`,
              title: topic.followUpAction,
              detail: topic.title,
            })),
        ].slice(0, 4)
      : [];

  React.useEffect(() => {
    if (
      meetingSchedule.length &&
      !meetingSchedule.some((meeting) => meeting.iso === activeMeetingDate)
    ) {
      queueMicrotask(() => setActiveMeetingDate(meetingSchedule[0].iso));
    }
  }, [activeMeetingDate, meetingSchedule]);

  const selectView = React.useCallback((view: WorkspaceView) => {
    setActiveView(view);
    const url = new URL(window.location.href);
    url.searchParams.set('view', view);
    window.history.replaceState({}, '', url);
  }, []);

  React.useEffect(() => {
    const requestedView = new URLSearchParams(window.location.search).get(
      'view',
    );
    if (requestedView === 'people' || requestedView === 'summaries') {
      queueMicrotask(() => selectView('decisions'));
      return;
    }
    if (
      requestedView === 'meeting' ||
      requestedView === 'backlog' ||
      requestedView === 'decisions' ||
      requestedView === 'topics' ||
      requestedView === 'reminders'
    )
      queueMicrotask(() => setActiveView(requestedView));
  }, [selectView]);

  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  React.useEffect(() => {
    if (!microsoftAuthConfigured) return;
    let active = true;
    void restoreMicrosoftSession()
      .then((profile) => {
        if (!active) return;
        setMicrosoftProfile(profile);
        setMicrosoftStatus(profile ? 'connected' : 'disconnected');
      })
      .catch((error: unknown) => {
        if (!active) return;
        setMicrosoftError(
          error instanceof Error
            ? error.message
            : 'Microsoft sign-in could not be verified.',
        );
        setMicrosoftStatus('error');
      });
    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    let active = true;
    if (microsoftStatus !== 'connected') {
      queueMicrotask(() => {
        if (!active) return;
        setWorkspaceStatus('idle');
        setWorkspaceVerified(false);
      });
      return () => {
        active = false;
      };
    }
    queueMicrotask(() => {
      if (!active) return;
      setWorkspaceStatus('loading');
      setWorkspaceError('');
    });
    void loadEmtWorkspace()
      .then(
        ({
          profile,
          topics: sharedTopics,
          settings,
          schedule,
          categories: sharedCategories,
          members: sharedMembers,
        }) => {
          if (!active) return;
          setMicrosoftProfile(profile);
          setMeetingAnchorDate(schedule.meetingAnchorDate);
          setMembers(sharedMembers);
          setNewLead((current) =>
            sharedMembers.some((member) => member.displayName === current)
              ? current
              : profile.displayName || sharedMembers[0]?.displayName || '',
          );
          setTopics(sharedTopics.filter((topic) => topic.bucket === 'agenda'));
          setBacklog(
            sharedTopics.filter((topic) => topic.bucket === 'backlog'),
          );
          setHistoricalDecisions(
            sharedTopics.filter((topic) => topic.bucket === 'history'),
          );
          if (sharedCategories?.length) {
            setCategories(sharedCategories);
            setCategoryDrafts(
              Object.fromEntries(
                sharedCategories.map((category) => [
                  category.id,
                  category.name,
                ]),
              ),
            );
            const firstActiveCategory = sharedCategories.find(
              (category) => category.active && !category.system,
            )?.name;
            if (firstActiveCategory) {
              setNewCategory((current) =>
                sharedCategories.some(
                  (category) => category.active && category.name === current,
                )
                  ? current
                  : firstActiveCategory,
              );
              setActiveDecisionTab((current) =>
                current === 'Archived' ||
                sharedCategories.some((category) => category.name === current)
                  ? current
                  : firstActiveCategory,
              );
            }
          }
          setRemindersOn(settings.remindersOn);
          setAgendaReminderTiming(settings.agendaReminderTiming);
          setFollowupReminderTiming(settings.followupReminderTiming);
          setOverdueRemindersOn(settings.overdueRemindersOn);
          setBusinessDaysOnly(settings.businessDaysOnly);
          setWorkspaceVerified(true);
          setWorkspaceStatus('ready');
        },
      )
      .catch((error: unknown) => {
        if (!active) return;
        if (isMicrosoftReauthenticationRequired(error)) {
          setMicrosoftError(error.message);
          setWorkspaceError('');
          setWorkspaceStatus('idle');
          setMicrosoftStatus('error');
          return;
        }
        setWorkspaceError(
          error instanceof Error
            ? error.message
            : 'The shared workspace could not be loaded.',
        );
        setWorkspaceStatus('error');
      });
    return () => {
      active = false;
    };
  }, [microsoftStatus, workspaceLoadAttempt]);

  async function addTopic(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    if (!signedIn) {
      setSignInOpen(true);
      return;
    }
    if (!beginMutation('add-discussion')) return;
    const topic: Omit<Topic, 'id'> = {
      bucket: newDestination === 'backlog' ? 'backlog' : 'agenda',
      title,
      category: newCategory,
      status: 'Scheduled',
      lead: newLead,
      leadInitials: newLead
        .split(' ')
        .map((part) => part[0])
        .join(''),
      time: '10 min',
      note: newContext.trim() || 'No preparation context has been added yet.',
      prepAction:
        newContext.trim() || 'Add the material needed for discussion.',
      decision: '',
      followUpOwner: '',
      followUpAction: '',
      dueDate: '',
      meetingDate:
        newDestination === 'backlog'
          ? undefined
          : newMeetingDate || selectedMeetingDate,
      source: 'Agenda',
    };
    setWorkspaceStatus('saving');
    try {
      const saved = await createEmtTopic(topic);
      if (saved.bucket === 'backlog')
        setBacklog((current) => [...current, saved]);
      else setTopics((current) => [...current, saved]);
      setNewTitle('');
      setNewContext('');
      setNewLead('Coco Hu');
      setNewCategory('Operations');
      setAddOpen(false);
      setWorkspaceStatus('ready');
      toast.add({
        type: 'success',
        title: 'Discussion added',
        description:
          saved.bucket === 'backlog'
            ? 'It is now in the shared discussion backlog.'
            : 'It is now on the shared meeting agenda.',
      });
    } catch (error) {
      setWorkspaceStatus('error');
      toast.add({
        type: 'error',
        title: 'Discussion not saved',
        description: error instanceof Error ? error.message : 'Try again.',
      });
    } finally {
      finishMutation();
    }
  }

  function openTopic(topic: Topic) {
    setSelectedTopic(topic);
    setActiveTopicTab('topic');
    setTopicDraft({
      title: topic.title,
      category: topic.category,
      lead: topic.lead,
      note: topic.note,
      destination:
        topic.bucket === 'backlog'
          ? 'backlog'
          : topic.meetingDate || selectedMeetingDate,
    });
    setDecisionDraft({
      decision: topic.decision,
      followUpOwner: topic.followUpOwner,
      followUpAction: topic.followUpAction,
      dueDate: topic.dueDate,
    });
  }

  function applyTopic(updated: Topic) {
    const placeInBucket = (
      items: Topic[],
      bucket: Topic['bucket'],
    ): Topic[] => {
      if (updated.bucket !== bucket)
        return items.filter((topic) => topic.id !== updated.id);
      return items.some((topic) => topic.id === updated.id)
        ? items.map((topic) => (topic.id === updated.id ? updated : topic))
        : [...items, updated];
    };
    setTopics((current) => placeInBucket(current, 'agenda'));
    setBacklog((current) => placeInBucket(current, 'backlog'));
    setHistoricalDecisions((current) => placeInBucket(current, 'history'));
    setSelectedTopic((current) =>
      current?.id === updated.id ? updated : current,
    );
  }

  async function updateTopic(
    updated: Topic,
    mutation: 'move-topic' | 'save-decision' | 'save-topic',
  ) {
    if (!signedIn) {
      setSignInOpen(true);
      return null;
    }
    if (!beginMutation(mutation)) return null;
    setWorkspaceStatus('saving');
    try {
      const saved = await saveEmtTopic(updated);
      applyTopic(saved);
      setWorkspaceStatus('ready');
      return saved;
    } catch (error) {
      setWorkspaceStatus('error');
      toast.add({
        type: 'error',
        title: 'Change not saved',
        description: error instanceof Error ? error.message : 'Try again.',
      });
      return null;
    } finally {
      finishMutation();
    }
  }

  async function saveDecision() {
    if (!selectedTopic) return;
    const decisionMeetingDate =
      selectedTopic.meetingDate || selectedMeetingDate;
    const saved = await updateTopic(
      {
        ...selectedTopic,
        ...decisionDraft,
        decisionDate: decisionDraft.decision
          ? selectedTopic.decisionDate || meetingDateLong(decisionMeetingDate)
          : undefined,
        decisionDateIso: decisionDraft.decision
          ? selectedTopic.decisionDateIso || decisionMeetingDate
          : undefined,
      },
      'save-decision',
    );
    if (saved)
      toast.add({
        type: 'success',
        title: 'Decision saved',
        description: 'The shared decision is now visible in the decision log.',
      });
  }

  async function toggleCompletion() {
    if (!selectedTopic || !beginMutation('set-completion')) return;
    const complete = !selectedTopic.completedAt;
    try {
      const saved = await setEmtCompletion(selectedTopic.id, complete);
      applyTopic(saved);
      toast.add({
        type: 'success',
        title: complete ? 'Follow-up completed' : 'Follow-up reopened',
        description: complete
          ? 'Completion is saved. Reminders for this item have stopped.'
          : 'This follow-up is open again and follows your reminder settings.',
      });
    } catch (error) {
      toast.add({
        type: 'error',
        title: 'Status not saved',
        description: error instanceof Error ? error.message : 'Try again.',
      });
    } finally {
      finishMutation();
    }
  }

  async function confirmDeleteDiscussion() {
    if (!discussionPendingDelete) return;
    if (!beginMutation('delete-discussion')) return;
    const discussion = discussionPendingDelete;
    setWorkspaceStatus('saving');
    try {
      const result = await deleteEmtTopic(discussion.id);
      const removeDiscussion = (items: Topic[]) =>
        items.filter((item) => item.id !== result.deletedTopicId);
      setTopics(removeDiscussion);
      setBacklog(removeDiscussion);
      setHistoricalDecisions(removeDiscussion);
      setSelectedTopic(null);
      setDiscussionPendingDelete(null);
      setWorkspaceStatus('ready');
      toast.add({
        type: 'success',
        title: 'Discussion deleted',
        description: `${result.deletedTopicTitle} was removed from the workspace.`,
      });
    } catch (error) {
      setWorkspaceStatus('error');
      toast.add({
        type: 'error',
        title: 'Discussion not deleted',
        description: error instanceof Error ? error.message : 'Try again.',
      });
    } finally {
      finishMutation();
    }
  }

  async function confirmDeleteDecision() {
    if (!decisionPendingDelete) return;
    if (!beginMutation('delete-decision')) return;
    const decision = decisionPendingDelete;
    setWorkspaceStatus('saving');
    try {
      const { topic: saved, movedToBacklog } = await deleteEmtDecision(
        decision.id,
      );
      const placeInBucket = (
        items: Topic[],
        bucket: Topic['bucket'],
      ): Topic[] => {
        if (saved.bucket !== bucket)
          return items.filter((item) => item.id !== saved.id);
        return items.some((item) => item.id === saved.id)
          ? items.map((item) => (item.id === saved.id ? saved : item))
          : [...items, saved];
      };
      setTopics((current) => placeInBucket(current, 'agenda'));
      setBacklog((current) => placeInBucket(current, 'backlog'));
      setHistoricalDecisions((current) => placeInBucket(current, 'history'));
      setSelectedTopic(null);
      setDecisionPendingDelete(null);
      setDecisionDraft({
        decision: '',
        followUpOwner: '',
        followUpAction: '',
        dueDate: '',
      });
      setWorkspaceStatus('ready');
      toast.add({
        type: 'success',
        title: 'Decision deleted',
        description: movedToBacklog
          ? 'The discussion was kept and moved to the backlog.'
          : 'The discussion was kept without its decision record.',
      });
    } catch (error) {
      setWorkspaceStatus('error');
      toast.add({
        type: 'error',
        title: 'Decision not deleted',
        description: error instanceof Error ? error.message : 'Try again.',
      });
    } finally {
      finishMutation();
    }
  }

  function beginTopicPointerDrag(
    event: React.PointerEvent<HTMLElement>,
    topic: Topic,
  ) {
    if (pendingMutation !== null || event.button !== 0) return;
    pointerDragRef.current = {
      pointerId: event.pointerId,
      topicId: topic.id,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function findMeetingDropTarget(clientX: number, clientY: number) {
    const target = document
      .elementFromPoint(clientX, clientY)
      ?.closest<HTMLElement>('[data-meeting-date]');
    return target?.dataset.meetingDate ?? '';
  }

  function moveTopicPointerDrag(event: React.PointerEvent<HTMLElement>) {
    const activeDrag = pointerDragRef.current;
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;

    if (!activeDrag.dragging) {
      const distance = Math.hypot(
        event.clientX - activeDrag.startX,
        event.clientY - activeDrag.startY,
      );
      if (distance < 6) return;
      activeDrag.dragging = true;
      suppressTopicOpenRef.current = true;
      setDraggedTopicId(activeDrag.topicId);
      document.body.classList.add('is-topic-pointer-dragging');
    }

    event.preventDefault();
    dragPreviewLockedRef.current = false;
    positionTopicDragPreview(event.clientX, event.clientY);
    const targetMeeting = findMeetingDropTarget(event.clientX, event.clientY);
    if (targetMeeting !== dragTargetDateRef.current) {
      dragTargetDateRef.current = targetMeeting;
      setDragTargetDate(targetMeeting);
    }
  }

  function removeTopicDragPreview() {
    dragPreviewLockedRef.current = false;
    dragPreviewX.set(-400);
    dragPreviewY.set(-400);
    document.body.classList.remove('is-topic-pointer-dragging');
  }

  function clearTopicDrag() {
    pointerDragRef.current = null;
    dragTargetDateRef.current = '';
    removeTopicDragPreview();
    setDraggedTopicId(null);
    setDragTargetDate('');
  }

  function cancelTopicPointerDrag() {
    suppressTopicOpenRef.current = false;
    clearTopicDrag();
  }

  async function assignTopicToMeeting(topicId: number, targetMeeting: string) {
    const topic = topics.find((item) => item.id === topicId);
    if (!topic || topic.meetingDate === targetMeeting) {
      return;
    }

    const saved = await updateTopic(
      { ...topic, bucket: 'agenda', meetingDate: targetMeeting },
      'move-topic',
    );
    setDraggedTopicId(null);
    if (!saved) return;
    setActiveMeetingDate(targetMeeting);
    toast.add({
      type: 'success',
      title: 'Meeting updated',
      description: `${topic.title} · ${meetingDateLong(targetMeeting)}`,
    });
  }

  function endTopicPointerDrag(event: React.PointerEvent<HTMLElement>) {
    const activeDrag = pointerDragRef.current;
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const targetMeeting = activeDrag.dragging
      ? findMeetingDropTarget(event.clientX, event.clientY)
      : '';
    const topicId = activeDrag.topicId;
    const wasDragging = activeDrag.dragging;
    clearTopicDrag();

    if (wasDragging) {
      window.setTimeout(() => {
        suppressTopicOpenRef.current = false;
      }, 0);
    }
    if (wasDragging && targetMeeting) {
      void assignTopicToMeeting(topicId, targetMeeting);
    }
  }

  async function saveTopicDetails() {
    if (!selectedTopic || !topicDraft.title.trim()) return;
    const destinationIsBacklog = topicDraft.destination === 'backlog';
    const isHistorical = selectedTopic.bucket === 'history';
    const leadInitials = topicDraft.lead
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join('');
    const saved = await updateTopic(
      {
        ...selectedTopic,
        bucket: isHistorical
          ? 'history'
          : destinationIsBacklog
            ? 'backlog'
            : 'agenda',
        meetingDate: isHistorical
          ? selectedTopic.meetingDate
          : destinationIsBacklog
            ? undefined
            : topicDraft.destination,
        title: topicDraft.title.trim(),
        category: topicDraft.category,
        lead: topicDraft.lead,
        leadInitials,
        note: topicDraft.note.trim(),
        prepAction: topicDraft.note.trim(),
      },
      'save-topic',
    );
    if (saved)
      toast.add({
        type: 'success',
        title: 'Topic updated',
        description:
          'The discussion details and meeting assignment were saved.',
      });
  }

  function currentSettings(
    overrides: Partial<WorkspaceSettings> = {},
  ): WorkspaceSettings {
    return {
      remindersOn,
      agendaReminderTiming,
      followupReminderTiming,
      overdueRemindersOn,
      businessDaysOnly,
      ...overrides,
    };
  }

  async function updateReminderSettings(next: WorkspaceSettings) {
    setRemindersOn(next.remindersOn);
    setAgendaReminderTiming(next.agendaReminderTiming);
    setFollowupReminderTiming(next.followupReminderTiming);
    setOverdueRemindersOn(next.overdueRemindersOn);
    setBusinessDaysOnly(next.businessDaysOnly);
    setWorkspaceStatus('saving');
    try {
      const saved = await saveEmtSettings(next);
      setRemindersOn(saved.remindersOn);
      setAgendaReminderTiming(saved.agendaReminderTiming);
      setFollowupReminderTiming(saved.followupReminderTiming);
      setOverdueRemindersOn(saved.overdueRemindersOn);
      setBusinessDaysOnly(saved.businessDaysOnly);
      setWorkspaceStatus('ready');
    } catch (error) {
      setWorkspaceStatus('error');
      toast.add({
        type: 'error',
        title: 'Settings not saved',
        description: error instanceof Error ? error.message : 'Try again.',
      });
    }
  }

  async function addTopicCategory(
    event: React.SyntheticEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const name = newTopicCategory.trim();
    if (!name) return;
    if (!beginMutation('add-category')) return;
    setWorkspaceStatus('saving');
    try {
      const saved = await createEmtCategory(name);
      setCategories((current) =>
        [...current, saved].sort(
          (left, right) => left.sortOrder - right.sortOrder,
        ),
      );
      setCategoryDrafts((current) => ({ ...current, [saved.id]: saved.name }));
      setNewTopicCategory('');
      setWorkspaceStatus('ready');
      toast.add({
        type: 'success',
        title: 'Topic added',
        description: `${saved.name} is now available across the workspace.`,
      });
    } catch (error) {
      setWorkspaceStatus('error');
      toast.add({
        type: 'error',
        title: 'Topic not added',
        description: error instanceof Error ? error.message : 'Try again.',
      });
    } finally {
      finishMutation();
    }
  }

  async function saveTopicCategory(category: WorkspaceCategory) {
    const name = (categoryDrafts[category.id] || '').trim();
    if (!name || name === category.name) return;
    setWorkspaceStatus('saving');
    try {
      const saved = await renameEmtCategory(category.id, name);
      const updateCategory = (topic: Topic) =>
        topic.category === category.name
          ? { ...topic, category: saved.name }
          : topic;
      setTopics((current) => current.map(updateCategory));
      setBacklog((current) => current.map(updateCategory));
      setHistoricalDecisions((current) => current.map(updateCategory));
      setCategories((current) =>
        current.map((item) => (item.id === saved.id ? saved : item)),
      );
      setCategoryDrafts((current) => ({ ...current, [saved.id]: saved.name }));
      setNewCategory((current) =>
        current === category.name ? saved.name : current,
      );
      setActiveDecisionTab((current) =>
        current === category.name ? saved.name : current,
      );
      setWorkspaceStatus('ready');
      toast.add({
        type: 'success',
        title: 'Topic renamed',
        description: `${category.name} is now ${saved.name}.`,
      });
    } catch (error) {
      setWorkspaceStatus('error');
      toast.add({
        type: 'error',
        title: 'Topic not renamed',
        description: error instanceof Error ? error.message : 'Try again.',
      });
    }
  }

  async function confirmDeleteTopicCategory() {
    if (!categoryPendingDelete) return;
    if (!beginMutation('delete-category')) return;
    const category = categoryPendingDelete;
    setWorkspaceStatus('saving');
    try {
      const result = await deleteEmtCategory(category.id);
      const reassignCategory = (topic: Topic) =>
        topic.category === category.name
          ? { ...topic, category: 'Uncategorised' }
          : topic;
      setTopics((current) => current.map(reassignCategory));
      setBacklog((current) => current.map(reassignCategory));
      setHistoricalDecisions((current) => current.map(reassignCategory));
      setCategories((current) =>
        current.filter((item) => item.id !== category.id),
      );
      setCategoryDrafts((current) => {
        const next = { ...current };
        delete next[category.id];
        return next;
      });
      const fallbackCategory =
        categories.find(
          (item) => item.id !== category.id && item.active && !item.system,
        )?.name || 'Uncategorised';
      setNewCategory((current) =>
        current === category.name ? fallbackCategory : current,
      );
      setActiveDecisionTab((current) =>
        current === category.name ? fallbackCategory : current,
      );
      setCategoryPendingDelete(null);
      setWorkspaceStatus('ready');
      toast.add({
        type: 'success',
        title: 'Topic deleted',
        description: result.reassignedCount
          ? `${result.reassignedCount} linked items were kept under Uncategorised.`
          : `${category.name} was removed.`,
      });
    } catch (error) {
      setWorkspaceStatus('error');
      toast.add({
        type: 'error',
        title: 'Topic not deleted',
        description: error instanceof Error ? error.message : 'Try again.',
      });
    } finally {
      finishMutation();
    }
  }

  async function startMicrosoftConnection() {
    if (!microsoftAuthConfigured) {
      toast.add({
        type: 'error',
        title: 'Microsoft setup required',
        description:
          'The Entra application ID and tenant ID have not been added yet.',
      });
      return;
    }
    setMicrosoftError('');
    setMicrosoftStatus('loading');
    try {
      await connectMicrosoft();
    } catch (error) {
      setMicrosoftError(
        error instanceof Error
          ? error.message
          : 'Microsoft sign-in could not start.',
      );
      setMicrosoftStatus('error');
    }
  }

  async function endMicrosoftConnection() {
    setMicrosoftError('');
    try {
      await disconnectMicrosoft();
    } catch (error) {
      setMicrosoftError(
        error instanceof Error
          ? error.message
          : 'Microsoft sign-out could not start.',
      );
      setMicrosoftStatus('error');
    }
  }

  function retryWorkspaceAccess() {
    setWorkspaceError('');
    setWorkspaceStatus('loading');
    setWorkspaceLoadAttempt((attempt) => attempt + 1);
  }

  if (!workspaceVerified) {
    if (microsoftStatus === 'connected' && workspaceStatus !== 'error') {
      return (
        <Toaster>
          <WorkspaceRestoring profile={microsoftProfile} />
        </Toaster>
      );
    }
    return (
      <Toaster>
        <AccessGate
          microsoftStatus={microsoftStatus}
          microsoftProfile={microsoftProfile}
          microsoftError={microsoftError}
          workspaceStatus={workspaceStatus}
          workspaceError={workspaceError}
          onSignIn={() => void startMicrosoftConnection()}
          onRetryWorkspace={retryWorkspaceAccess}
          onSignOut={() => void endMicrosoftConnection()}
        />
      </Toaster>
    );
  }

  return (
    <Toaster>
      <div className="app-shell">
        {draggedTopic ? (
          <motion.div
            aria-hidden="true"
            className="topic-drag-preview"
            initial={false}
            style={{
              x: prefersReducedMotion ? dragPreviewX : dragPreviewSpringX,
              y: prefersReducedMotion ? dragPreviewY : dragPreviewSpringY,
            }}
          >
            <span className="topic-drag-layer topic-drag-layer-rear" />
            <span className="topic-drag-layer topic-drag-layer-middle" />
            <div className="topic-drag-card">
              <strong>{draggedTopic.title}</strong>
              <div className="topic-drag-meta">
                <span className="topic-drag-category">
                  {draggedTopic.category}
                </span>
                <span className="topic-drag-cue">Moving topic</span>
              </div>
            </div>
          </motion.div>
        ) : null}
        <header className="brand-header">
          <div className="brand-lockup">
            <Image
              src={`${APP_BASE_PATH}/assets/gms-logo-white.png`}
              alt="GMS 10 Years"
              className="gms-logo"
              width={150}
              height={34}
              priority
            />
            <span className="brand-divider" aria-hidden="true" />
            <span className="product-name">EMT Tracker</span>
          </div>
          <div className="header-actions">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    className="profile-button"
                    aria-label={`Open account menu for ${microsoftProfile?.displayName || 'Microsoft account'}`}
                  />
                }
              >
                <Avatar size="sm" className="profile-avatar">
                  <AvatarFallback>
                    {profileInitials(microsoftProfile?.displayName || '')}
                  </AvatarFallback>
                </Avatar>
                <span className="profile-copy">
                  <strong>
                    {microsoftProfile?.displayName || 'Microsoft account'}
                  </strong>
                  <small>Microsoft account</small>
                </span>
                <ChevronDown className="profile-chevron" aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={8}
                className="profile-menu"
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="profile-menu-identity">
                    <Avatar className="profile-menu-avatar">
                      <AvatarFallback>
                        {profileInitials(microsoftProfile?.displayName || '')}
                      </AvatarFallback>
                    </Avatar>
                    <span>
                      <strong>{microsoftProfile?.displayName}</strong>
                      <small>{microsoftProfile?.email}</small>
                    </span>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="profile-menu-item"
                  onClick={() => void endMicrosoftConnection()}
                >
                  <LogOut aria-hidden="true" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <SidebarProvider className="workspace-provider">
          <div className="workspace-layout">
            <Sidebar collapsible="none" className="workspace-sidebar">
              <Navigation
                activeView={activeView}
                backlogCount={backlog.length}
                decisionCount={recordedDecisions.length}
                onSelect={selectView}
              />
            </Sidebar>
            <main className="workspace-main" id="workspace-main">
              <div className="mobile-topbar">
                <Button
                  variant="outline"
                  className="mobile-menu-button"
                  aria-expanded={mobileNavOpen}
                  aria-controls="mobile-navigation"
                  onClick={() => setMobileNavOpen(true)}
                >
                  <Menu aria-hidden="true" />
                  Menu
                </Button>
              </div>

              {activeView === 'meeting' ? (
                <>
                  <section
                    className="meeting-intro"
                    aria-labelledby="meeting-title"
                  >
                    <div>
                      <p className="meeting-date">Weekly · every Monday</p>
                      <h1 id="meeting-title">Executive meeting schedule</h1>
                    </div>
                  </section>
                  <section
                    className="meeting-card-grid"
                    aria-label="Upcoming meetings"
                  >
                    {meetingSchedule.map((meeting, index) => {
                      const meetingTopicCount = topics.filter(
                        (topic) => topic.meetingDate === meeting.iso,
                      ).length;
                      const isSelected = selectedMeetingDate === meeting.iso;
                      const isDropTarget = dragTargetDate === meeting.iso;
                      return (
                        <article
                          className={`meeting-option-card${meeting.isToday ? ' is-today' : ''}${isSelected ? ' is-selected' : ''}${isDropTarget ? ' is-drop-target' : ''}`}
                          data-meeting-date={meeting.iso}
                          key={meeting.iso}
                        >
                          <button
                            type="button"
                            className="meeting-card-select"
                            aria-pressed={isSelected}
                            onClick={() => setActiveMeetingDate(meeting.iso)}
                          >
                            <span>
                              {meeting.isToday
                                ? 'Today’s meeting'
                                : index === 0
                                  ? 'Next meeting'
                                  : `Meeting ${index + 1}`}
                            </span>
                            <strong>{meeting.longDate}</strong>
                            <small>
                              {isDropTarget
                                ? 'Drop topic here'
                                : `${meetingTopicCount} ${meetingTopicCount === 1 ? 'topic' : 'topics'}`}
                            </small>
                            <Badge className="countdown-badge">
                              {meeting.isToday
                                ? 'Today'
                                : `${meeting.countdownDays} days to go`}
                            </Badge>
                          </button>
                          <Button
                            className="primary-action meeting-card-action"
                            onClick={() => {
                              setActiveMeetingDate(meeting.iso);
                              setNewMeetingDate(meeting.iso);
                              setNewDestination('meeting');
                              setAddOpen(true);
                            }}
                          >
                            <Plus aria-hidden="true" />
                            Add topic
                          </Button>
                        </article>
                      );
                    })}
                  </section>
                  <section
                    className="agenda-panel"
                    aria-labelledby="agenda-heading"
                  >
                    <div className="panel-toolbar">
                      <div>
                        <h2 id="agenda-heading">
                          {selectedMeeting?.isToday
                            ? 'Today’s agenda'
                            : 'Meeting agenda'}
                        </h2>
                        <p>
                          {selectedMeeting?.longDate} ·{' '}
                          {selectedMeetingTopics.length}{' '}
                          {selectedMeetingTopics.length === 1
                            ? 'topic'
                            : 'topics'}
                        </p>
                        <p className="agenda-drag-hint">
                          Drag a topic onto another meeting card, or open it to
                          choose a meeting.
                        </p>
                      </div>
                      <label className="search-field" htmlFor="agenda-search">
                        <Search aria-hidden="true" />
                        <span className="sr-only">Search agenda</span>
                        <Input
                          id="agenda-search"
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                          placeholder="Search agenda"
                        />
                      </label>
                    </div>
                    <div className="agenda-list">
                      {filteredTopics.map((topic, index) => (
                        <div
                          className={`agenda-topic-row${draggedTopicId === topic.id ? ' is-dragging' : ''}`}
                          key={topic.id}
                        >
                          <button
                            type="button"
                            className="agenda-row"
                            onClick={(event) => {
                              if (suppressTopicOpenRef.current) {
                                event.preventDefault();
                                return;
                              }
                              openTopic(topic);
                            }}
                            onPointerCancel={cancelTopicPointerDrag}
                            onPointerDown={(event) =>
                              beginTopicPointerDrag(event, topic)
                            }
                            onPointerMove={moveTopicPointerDrag}
                            onPointerUp={endTopicPointerDrag}
                          >
                            <span className="agenda-order">
                              {String(index + 1).padStart(2, '0')}
                            </span>
                            <span className="agenda-summary">
                              <span className="agenda-title">
                                {topic.title}
                              </span>
                              <span className="agenda-meta">
                                <span className="topic-tag">
                                  {topic.category}
                                </span>
                                <FollowUpStatus
                                  completedAt={topic.completedAt}
                                />
                                <span>Proposed by {topic.lead}</span>
                              </span>
                            </span>
                            <ChevronRight
                              className="row-chevron"
                              aria-hidden="true"
                            />
                          </button>
                        </div>
                      ))}
                      {filteredTopics.length === 0 ? (
                        <div className="empty-state">
                          <Search aria-hidden="true" />
                          <strong>No matching topics</strong>
                          <span>
                            {search
                              ? 'Try another title, category or proposer.'
                              : 'Add a topic to this meeting or choose another meeting card.'}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </section>
                </>
              ) : activeView === 'backlog' ? (
                <section
                  className="backlog-view"
                  aria-labelledby="backlog-title"
                >
                  <div className="meeting-intro">
                    <div>
                      <p className="meeting-date">
                        Topics waiting for a future agenda
                      </p>
                      <h1 id="backlog-title">Discussion backlog</h1>
                      <p className="intro-copy">
                        Open a topic to assign it to an upcoming EMT meeting.
                      </p>
                    </div>
                  </div>
                  <section className="agenda-panel backlog-panel">
                    <div className="panel-toolbar">
                      <div>
                        <h2>Waiting for discussion</h2>
                        <p>
                          {backlog.length}{' '}
                          {backlog.length === 1 ? 'topic' : 'topics'}
                        </p>
                      </div>
                      <Button
                        className="primary-action"
                        onClick={() => {
                          setNewDestination('backlog');
                          setAddOpen(true);
                        }}
                      >
                        <Plus aria-hidden="true" />
                        Add to backlog
                      </Button>
                    </div>
                    <div className="agenda-list">
                      {backlog.map((topic, index) => (
                        <div className="backlog-row" key={topic.id}>
                          <button
                            type="button"
                            className="backlog-open"
                            onClick={() => openTopic(topic)}
                          >
                            <span className="agenda-order">
                              {String(index + 1).padStart(2, '0')}
                            </span>
                            <span className="agenda-summary">
                              <span className="agenda-title">
                                {topic.title}
                              </span>
                              <span className="agenda-meta">
                                <span className="topic-tag">
                                  {topic.category}
                                </span>
                                <FollowUpStatus
                                  completedAt={topic.completedAt}
                                />
                                <span>Proposed by {topic.lead}</span>
                              </span>
                            </span>
                          </button>
                        </div>
                      ))}
                      {backlog.length === 0 ? (
                        <div className="empty-state">
                          <CheckCircle2 aria-hidden="true" />
                          <strong>Backlog cleared</strong>
                          <span>
                            Every discussion has been placed on an agenda.
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </section>
                </section>
              ) : activeView === 'decisions' ? (
                <section
                  className="decisions-view"
                  aria-labelledby="decisions-title"
                >
                  <div className="meeting-intro">
                    <div>
                      <p className="meeting-date">Topic tabs · newest first</p>
                      <h1 id="decisions-title">Decision log</h1>
                      <p className="intro-copy">
                        Open a topic tab to review its decisions, owners and
                        follow-up actions. Anything older than two months moves
                        to Archived automatically.
                      </p>
                    </div>
                  </div>
                  <section
                    className="decisions-panel"
                    aria-labelledby="decision-log-title"
                  >
                    <div className="panel-toolbar">
                      <div>
                        <h2 id="decision-log-title">Recorded decisions</h2>
                        <p>
                          {activeDecisions.length} current ·{' '}
                          {archivedDecisions.length} archived · date descending
                        </p>
                      </div>
                      <div className="decision-toolbar-actions">
                        <label
                          className="search-field decision-search"
                          htmlFor="decision-search"
                        >
                          <Search aria-hidden="true" />
                          <span className="sr-only">
                            Fuzzy search current and archived decisions
                          </span>
                          <Input
                            id="decision-search"
                            value={decisionSearch}
                            onChange={(event) =>
                              setDecisionSearch(event.target.value)
                            }
                            placeholder="Search current + archived"
                          />
                        </label>
                        <label
                          className="decision-owner-filter"
                          htmlFor="decision-owner-filter"
                        >
                          <span>Owner</span>
                          <NativeSelect
                            id="decision-owner-filter"
                            value={decisionOwner}
                            onChange={(event) =>
                              setDecisionOwner(event.target.value)
                            }
                          >
                            <NativeSelectOption>All owners</NativeSelectOption>
                            {members.map((member) => (
                              <NativeSelectOption key={member.email}>
                                {member.displayName}
                              </NativeSelectOption>
                            ))}
                          </NativeSelect>
                        </label>
                        {hasDecisionSearch ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDecisionSearch('')}
                          >
                            Clear
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <Tabs
                      value={activeDecisionTab}
                      onValueChange={(value) =>
                        setActiveDecisionTab(value as DecisionTab)
                      }
                      className="decision-tabs"
                    >
                      <div className="decision-tab-scroll">
                        <TabsList
                          className="decision-tab-list"
                          aria-label="Decision topics"
                        >
                          {decisionTabs.map(({ label, count }) => (
                            <TabsTrigger
                              value={label}
                              className="decision-tab"
                              key={label}
                            >
                              {label === 'Archived' ? (
                                <Archive aria-hidden="true" />
                              ) : null}
                              <span>{label}</span>
                              <span className="decision-tab-count">
                                {count}
                              </span>
                            </TabsTrigger>
                          ))}
                        </TabsList>
                      </div>
                      <TabsContent
                        value={activeDecisionTab}
                        className="decision-tab-panel"
                      >
                        <div className="decision-list">
                          {visibleDecisions.map((topic) => {
                            const archived = Boolean(
                              topic.decisionDateIso &&
                              topic.decisionDateIso < archiveThreshold,
                            );
                            return (
                              <button
                                type="button"
                                className="decision-row"
                                key={topic.id}
                                onClick={() => openTopic(topic)}
                              >
                                <span className="decision-date">
                                  {formatDecisionDate(
                                    topic.decisionDateIso,
                                    topic.decisionDate,
                                  )}
                                  <span className="decision-date-meta">
                                    <small>{topic.source || 'Agenda'}</small>
                                    {hasDecisionSearch ? (
                                      <small
                                        className={
                                          archived
                                            ? 'archive-label'
                                            : 'current-label'
                                        }
                                      >
                                        {archived ? 'Archived' : topic.category}
                                      </small>
                                    ) : null}
                                  </span>
                                </span>
                                <span className="decision-summary">
                                  <span className="decision-topic">
                                    {topic.title}
                                  </span>
                                  <span className="decision-copy">
                                    {topic.decision}
                                  </span>
                                </span>
                                <span className="decision-followup">
                                  <FollowUpStatus
                                    completedAt={topic.completedAt}
                                  />
                                  <strong>
                                    {topic.followUpAction || 'Not added'}
                                  </strong>
                                  <small>
                                    {topic.followUpOwner || 'Not assigned'} ·
                                    Due {formatDueDate(topic.dueDate)}
                                  </small>
                                </span>
                                <ChevronRight
                                  className="row-chevron"
                                  aria-hidden="true"
                                />
                              </button>
                            );
                          })}
                          {visibleDecisions.length === 0 ? (
                            <div className="empty-state">
                              {activeDecisionTab === 'Archived' &&
                              !hasDecisionSearch ? (
                                <Archive aria-hidden="true" />
                              ) : (
                                <Search aria-hidden="true" />
                              )}
                              <strong>
                                {hasDecisionSearch
                                  ? 'No matching decisions'
                                  : activeDecisionTab === 'Archived'
                                    ? 'Nothing archived yet'
                                    : `No ${activeDecisionTab} decisions for ${decisionOwner}`}
                              </strong>
                              <span>
                                {hasDecisionSearch
                                  ? 'Try a title, topic, owner, date or part of a phrase.'
                                  : activeDecisionTab === 'Archived'
                                    ? 'Decisions move here automatically after two months.'
                                    : decisionOwner === 'All owners'
                                      ? 'Decisions will appear here after the meeting.'
                                      : 'Choose another owner or topic.'}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </TabsContent>
                    </Tabs>
                  </section>
                </section>
              ) : activeView === 'topics' ? (
                <section
                  className="topic-settings-view"
                  aria-labelledby="topic-settings-title"
                >
                  <div className="meeting-intro">
                    <div>
                      <h1 id="topic-settings-title">Topic settings</h1>
                      <p className="intro-copy">
                        Choose the topic groups used across agendas and the
                        decision log.
                      </p>
                    </div>
                  </div>
                  <section
                    className="settings-panel topic-manager"
                    aria-labelledby="topic-groups-title"
                  >
                    <div className="topic-manager-head">
                      <div>
                        <h2 id="topic-groups-title">Topic groups</h2>
                        <p>
                          Rename an existing topic or add a new one for future
                          discussions.
                        </p>
                      </div>
                      <form
                        className="topic-add-row"
                        onSubmit={addTopicCategory}
                        aria-busy={pendingMutation === 'add-category'}
                      >
                        <label htmlFor="new-topic-category">
                          <span className="sr-only">New topic name</span>
                          <Input
                            id="new-topic-category"
                            value={newTopicCategory}
                            onChange={(event) =>
                              setNewTopicCategory(event.target.value)
                            }
                            placeholder="New topic name"
                            maxLength={40}
                          />
                        </label>
                        <Button
                          type="submit"
                          className="primary-action mutation-button"
                          disabled={
                            !newTopicCategory.trim() || pendingMutation !== null
                          }
                          aria-busy={pendingMutation === 'add-category'}
                        >
                          {pendingMutation === 'add-category' ? (
                            <>
                              <LoaderCircle
                                className="spin"
                                aria-hidden="true"
                              />
                              Adding…
                            </>
                          ) : (
                            <>
                              <Plus aria-hidden="true" />
                              Add topic
                            </>
                          )}
                        </Button>
                      </form>
                    </div>
                    <div className="topic-settings-list">
                      {categories
                        .filter(
                          (category) => category.active && !category.system,
                        )
                        .map((category) => {
                          const usageCount = workspaceTopics.filter(
                            (topic) => topic.category === category.name,
                          ).length;
                          const draft =
                            categoryDrafts[category.id] ?? category.name;
                          const changed =
                            draft.trim() && draft.trim() !== category.name;
                          return (
                            <div
                              className="topic-setting-row"
                              key={category.id}
                            >
                              <label htmlFor={`topic-category-${category.id}`}>
                                <span>Topic name</span>
                                <Input
                                  id={`topic-category-${category.id}`}
                                  value={draft}
                                  maxLength={40}
                                  onChange={(event) =>
                                    setCategoryDrafts((current) => ({
                                      ...current,
                                      [category.id]: event.target.value,
                                    }))
                                  }
                                />
                              </label>
                              <span className="topic-usage">
                                {usageCount} linked{' '}
                                {usageCount === 1 ? 'item' : 'items'}
                              </span>
                              <div className="topic-row-actions">
                                <Button
                                  variant="outline"
                                  disabled={!changed}
                                  onClick={() =>
                                    void saveTopicCategory(category)
                                  }
                                >
                                  Save
                                </Button>
                                <Button
                                  variant="destructive"
                                  aria-label={`Delete ${category.name}`}
                                  onClick={() =>
                                    setCategoryPendingDelete({
                                      ...category,
                                      usageCount,
                                    })
                                  }
                                >
                                  <Trash2 aria-hidden="true" />
                                  Delete
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </section>
                </section>
              ) : (
                <section
                  className="reminders-view"
                  aria-labelledby="reminders-title"
                >
                  <div className="meeting-intro">
                    <div>
                      <h1 id="reminders-title">Your reminder settings</h1>
                      <p>
                        These preferences apply to your assigned topics and
                        follow-up actions across the workspace.
                      </p>
                    </div>
                  </div>
                  <div className="settings-layout">
                    <section
                      className="settings-panel"
                      aria-labelledby="reminder-rules-title"
                    >
                      <div className="settings-section connection-section">
                        <div>
                          <span className="icon-tile">
                            <LogIn aria-hidden="true" />
                          </span>
                          <div>
                            <h2>Microsoft connection</h2>
                            <p>
                              {signedIn
                                ? workspaceStatus === 'error'
                                  ? workspaceError ||
                                    'Shared workspace unavailable'
                                  : `${microsoftProfile?.displayName || 'Microsoft account'} · profile and shared data verified`
                                : microsoftStatus === 'unconfigured'
                                  ? 'Microsoft Entra setup required'
                                  : microsoftStatus === 'loading'
                                    ? 'Checking the saved Microsoft session'
                                    : 'Required to open the shared EMT workspace'}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant={signedIn ? 'outline' : 'default'}
                          className={signedIn ? '' : 'primary-action'}
                          onClick={() => setSignInOpen(true)}
                        >
                          {microsoftStatus === 'loading' ? (
                            <>
                              <LoaderCircle
                                className="spin"
                                aria-hidden="true"
                              />
                              Checking
                            </>
                          ) : signedIn ? (
                            <>
                              <Check aria-hidden="true" />
                              Connected
                            </>
                          ) : (
                            'Connect Microsoft'
                          )}
                        </Button>
                      </div>
                      <div className="settings-section global-setting">
                        <div>
                          <h2 id="reminder-rules-title">Automatic reminders</h2>
                          <p>
                            Apply these rules only to reminders assigned to your
                            Microsoft account.
                          </p>
                        </div>
                        <Switch
                          checked={signedIn && remindersOn}
                          disabled={!signedIn}
                          onCheckedChange={(checked) =>
                            void updateReminderSettings(
                              currentSettings({ remindersOn: checked }),
                            )
                          }
                          aria-label="Automatic reminders"
                        />
                      </div>
                      <div className="settings-section reminder-rules">
                        <div className="setting-row">
                          <div className="rule-copy">
                            <Bell aria-hidden="true" />
                            <span>
                              <strong>Agenda proposer reminder</strong>
                              <small>
                                Ask the topic proposer to prepare input before
                                the meeting.
                              </small>
                            </span>
                          </div>
                          <NativeSelect
                            value={agendaReminderTiming}
                            onChange={(event) =>
                              void updateReminderSettings(
                                currentSettings({
                                  agendaReminderTiming: event.target.value,
                                }),
                              )
                            }
                            disabled={!signedIn || !remindersOn}
                          >
                            <NativeSelectOption>
                              1 business day before
                            </NativeSelectOption>
                            <NativeSelectOption>
                              2 business days before
                            </NativeSelectOption>
                            <NativeSelectOption>
                              3 business days before
                            </NativeSelectOption>
                          </NativeSelect>
                        </div>
                        <div className="setting-row">
                          <div className="rule-copy">
                            <ClipboardCheck aria-hidden="true" />
                            <span>
                              <strong>Follow-up reminder</strong>
                              <small>
                                Remind the named owner before an agreed action
                                is due.
                              </small>
                            </span>
                          </div>
                          <NativeSelect
                            value={followupReminderTiming}
                            onChange={(event) =>
                              void updateReminderSettings(
                                currentSettings({
                                  followupReminderTiming: event.target.value,
                                }),
                              )
                            }
                            disabled={!signedIn || !remindersOn}
                          >
                            <NativeSelectOption>
                              On the due date
                            </NativeSelectOption>
                            <NativeSelectOption>
                              1 business day before
                            </NativeSelectOption>
                            <NativeSelectOption>
                              2 business days before
                            </NativeSelectOption>
                          </NativeSelect>
                        </div>
                        <div className="setting-row">
                          <div className="rule-copy">
                            <CircleAlert aria-hidden="true" />
                            <span>
                              <strong>Overdue follow-up</strong>
                              <small>
                                Send a weekday nudge until the owner marks the
                                action complete.
                              </small>
                            </span>
                          </div>
                          <Switch
                            checked={overdueRemindersOn}
                            onCheckedChange={(checked) =>
                              void updateReminderSettings(
                                currentSettings({
                                  overdueRemindersOn: checked,
                                }),
                              )
                            }
                            disabled={!signedIn || !remindersOn}
                            aria-label="Overdue follow-up reminders"
                          />
                        </div>
                        <div className="setting-row">
                          <div className="rule-copy">
                            <CalendarDays aria-hidden="true" />
                            <span>
                              <strong>Business days only</strong>
                              <small>
                                Do not send reminders on weekends. Time zone:
                                Australia/Melbourne.
                              </small>
                            </span>
                          </div>
                          <Switch
                            checked={businessDaysOnly}
                            onCheckedChange={(checked) =>
                              void updateReminderSettings(
                                currentSettings({ businessDaysOnly: checked }),
                              )
                            }
                            disabled={!signedIn || !remindersOn}
                            aria-label="Business days only"
                          />
                        </div>
                      </div>
                    </section>
                    <aside
                      className="reminder-preview"
                      aria-labelledby="preview-reminders-title"
                    >
                      <div className="preview-head">
                        <span className="icon-tile">
                          <Mail aria-hidden="true" />
                        </span>
                        <div>
                          <h2 id="preview-reminders-title">
                            Your scheduled reminders
                          </h2>
                          <p>
                            Topics and actions assigned to{' '}
                            {currentMember?.displayName ||
                              'the signed-in account'}
                            .
                          </p>
                        </div>
                      </div>
                      <div className="preview-list">
                        {personalReminders.map((reminder) => (
                          <article
                            className="preview-message"
                            key={reminder.id}
                          >
                            <span className="preview-time">
                              {reminder.timing}
                            </span>
                            <strong>{reminder.title}</strong>
                            <p>{reminder.detail}</p>
                          </article>
                        ))}
                        {personalReminders.length === 0 ? (
                          <div className="personal-reminder-empty">
                            <CheckCircle2 aria-hidden="true" />
                            <strong>No reminders scheduled for you</strong>
                            <span>
                              Your own topic preparation and follow-up actions
                              will appear here.
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </aside>
                  </div>
                </section>
              )}
            </main>
          </div>
        </SidebarProvider>

        <footer className="site-footer" aria-label="Site information">
          <a
            className="site-footer-logo-link"
            href="https://kmt.global/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Visit Kaleidoscope Management Technology"
          >
            <Image
              src={`${APP_BASE_PATH}/assets/kmt-logo.png`}
              alt="KMT"
              className="site-footer-logo"
              width={110}
              height={20}
            />
          </a>
          <p className="site-footer-tagline">See Infinitely.</p>
          <p className="site-footer-copyright">
            © 2026 Kaleidoscope Management Technology. All rights reserved.
          </p>
        </footer>

        <Dialog
          open={addOpen}
          onOpenChange={(open) => {
            if (pendingMutation === 'add-discussion') return;
            setAddOpen(open);
          }}
        >
          <DialogContent className="form-dialog">
            <form
              onSubmit={addTopic}
              aria-busy={pendingMutation === 'add-discussion'}
            >
              <DialogHeader>
                <DialogTitle>Add a discussion topic</DialogTitle>
                <DialogDescription>
                  Capture what the EMT should discuss and who proposed it.
                </DialogDescription>
              </DialogHeader>
              <div className="form-stack">
                <label htmlFor="discussion-title">
                  <span>Topic title</span>
                  <Input
                    id="discussion-title"
                    value={newTitle}
                    onChange={(event) => setNewTitle(event.target.value)}
                    placeholder="What needs discussion or a decision?"
                    required
                  />
                </label>
                <label htmlFor="discussion-destination">
                  <span>Destination</span>
                  <NativeSelect
                    id="discussion-destination"
                    value={
                      newDestination === 'backlog'
                        ? 'backlog'
                        : newMeetingDate || selectedMeetingDate
                    }
                    onChange={(event) => {
                      const destination = event.target.value;
                      if (destination === 'backlog') {
                        setNewDestination('backlog');
                        setNewMeetingDate('');
                        return;
                      }
                      setNewDestination('meeting');
                      setNewMeetingDate(destination);
                    }}
                  >
                    {meetingSchedule.map((meeting) => (
                      <NativeSelectOption value={meeting.iso} key={meeting.iso}>
                        {meeting.isToday ? 'Today' : meeting.longDate}
                      </NativeSelectOption>
                    ))}
                    <NativeSelectOption value="backlog">
                      Discussion backlog
                    </NativeSelectOption>
                  </NativeSelect>
                </label>
                <div className="form-pair">
                  <label htmlFor="discussion-category">
                    <span>Topic</span>
                    <NativeSelect
                      id="discussion-category"
                      value={newCategory}
                      onChange={(event) => setNewCategory(event.target.value)}
                    >
                      {categories
                        .filter(
                          (category) => category.active && !category.system,
                        )
                        .map((category) => (
                          <NativeSelectOption key={category.id}>
                            {category.name}
                          </NativeSelectOption>
                        ))}
                    </NativeSelect>
                  </label>
                  <label htmlFor="discussion-lead">
                    <span>Proposed by</span>
                    <NativeSelect
                      id="discussion-lead"
                      value={newLead}
                      onChange={(event) => setNewLead(event.target.value)}
                    >
                      {members.map((member) => (
                        <NativeSelectOption key={member.email}>
                          {member.displayName}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </label>
                </div>
                <label htmlFor="discussion-context">
                  <span>Context for the meeting</span>
                  <Textarea
                    id="discussion-context"
                    value={newContext}
                    onChange={(event) => setNewContext(event.target.value)}
                    placeholder="Add the decision needed, useful links or preparation notes."
                  />
                </label>
              </div>
              <DialogFooter>
                <DialogClose
                  render={
                    <Button
                      variant="ghost"
                      type="button"
                      disabled={pendingMutation === 'add-discussion'}
                    />
                  }
                >
                  Cancel
                </DialogClose>
                <Button
                  type="submit"
                  className="primary-action mutation-button"
                  disabled={!newTitle.trim() || pendingMutation !== null}
                  aria-busy={pendingMutation === 'add-discussion'}
                >
                  {pendingMutation === 'add-discussion' ? (
                    <>
                      <LoaderCircle className="spin" aria-hidden="true" />
                      Adding…
                    </>
                  ) : (
                    <>
                      <Plus aria-hidden="true" />
                      Add topic
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={signInOpen} onOpenChange={setSignInOpen}>
          <DialogContent className="signin-dialog">
            <DialogHeader>
              <span className="signin-icon">
                <LogIn aria-hidden="true" />
              </span>
              <DialogTitle>
                {signedIn
                  ? 'Microsoft connection'
                  : 'Connect your Microsoft account'}
              </DialogTitle>
              <DialogDescription>
                {signedIn
                  ? 'Your GMS Microsoft profile was verified through Microsoft Graph.'
                  : 'Sign in with your GMS work account. This first connection asks only for your basic profile.'}
              </DialogDescription>
            </DialogHeader>
            <div className="permission-list">
              <div>
                <UserRound aria-hidden="true" />
                <span>
                  <strong>Basic profile</strong>
                  <small>
                    {signedIn
                      ? `${microsoftProfile?.displayName} · ${microsoftProfile?.email}`
                      : 'Used to identify you inside the EMT workspace'}
                  </small>
                </span>
              </div>
              <div>
                <Mail aria-hidden="true" />
                <span>
                  <strong>Reminder sender</strong>
                  <small>
                    Automatic reminders use insights@gms.global. Your account is
                    never used to send email.
                  </small>
                </span>
              </div>
              <div>
                <CalendarDays aria-hidden="true" />
                <span>
                  <strong>Calendar</strong>
                  <small>Calendar access is not enabled</small>
                </span>
              </div>
            </div>
            {microsoftStatus === 'unconfigured' ? (
              <p className="connection-status-note is-pending">
                Microsoft Entra registration is still being configured. No
                simulated connection will be shown.
              </p>
            ) : microsoftError ? (
              <p className="connection-status-note is-error">
                {microsoftError}
              </p>
            ) : signedIn ? (
              <p className="connection-status-note is-success">
                Connection verified with Microsoft Graph.
              </p>
            ) : (
              <p className="connection-status-note">
                You will be redirected to Microsoft to complete sign-in.
              </p>
            )}
            <DialogFooter>
              <DialogClose render={<Button variant="ghost" />}>
                {signedIn ? 'Close' : 'Cancel'}
              </DialogClose>
              {signedIn ? (
                <Button variant="outline" onClick={endMicrosoftConnection}>
                  <LogOut aria-hidden="true" />
                  Disconnect
                </Button>
              ) : (
                <Button
                  className="primary-action"
                  disabled={
                    microsoftStatus === 'loading' ||
                    microsoftStatus === 'unconfigured'
                  }
                  onClick={startMicrosoftConnection}
                >
                  {microsoftStatus === 'loading' ? (
                    <>
                      <LoaderCircle className="spin" aria-hidden="true" />
                      Checking
                    </>
                  ) : (
                    'Continue with Microsoft'
                  )}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(categoryPendingDelete)}
          onOpenChange={(open) => {
            if (pendingMutation === 'delete-category') return;
            if (!open) setCategoryPendingDelete(null);
          }}
        >
          <DialogContent className="form-dialog category-delete-dialog">
            <DialogHeader>
              <span className="signin-icon delete-topic-icon">
                <Trash2 aria-hidden="true" />
              </span>
              <DialogTitle>Delete this topic?</DialogTitle>
              <DialogDescription>
                {categoryPendingDelete
                  ? `${categoryPendingDelete.name} will no longer be available for new discussions.`
                  : ''}
              </DialogDescription>
            </DialogHeader>
            <div className="delete-topic-warning">
              <CircleAlert aria-hidden="true" />
              <p>
                <strong>
                  {categoryPendingDelete?.usageCount || 0} linked{' '}
                  {(categoryPendingDelete?.usageCount || 0) === 1
                    ? 'item'
                    : 'items'}
                </strong>
                <span>
                  Existing agenda items and decisions will be kept and moved to
                  Uncategorised.
                </span>
              </p>
            </div>
            <DialogFooter>
              <DialogClose
                render={
                  <Button
                    variant="ghost"
                    type="button"
                    disabled={pendingMutation === 'delete-category'}
                  />
                }
              >
                Cancel
              </DialogClose>
              <Button
                variant="destructive"
                className="mutation-button"
                disabled={pendingMutation !== null}
                aria-busy={pendingMutation === 'delete-category'}
                onClick={() => void confirmDeleteTopicCategory()}
              >
                {pendingMutation === 'delete-category' ? (
                  <>
                    <LoaderCircle className="spin" aria-hidden="true" />
                    Deleting…
                  </>
                ) : (
                  <>
                    <Trash2 aria-hidden="true" />
                    Delete topic
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(decisionPendingDelete)}
          onOpenChange={(open) => {
            if (pendingMutation === 'delete-decision') return;
            if (!open) setDecisionPendingDelete(null);
          }}
        >
          <DialogContent className="form-dialog category-delete-dialog">
            <DialogHeader>
              <span className="signin-icon delete-topic-icon">
                <Trash2 aria-hidden="true" />
              </span>
              <DialogTitle>Delete this decision?</DialogTitle>
              <DialogDescription>
                {decisionPendingDelete?.title || ''}
              </DialogDescription>
            </DialogHeader>
            <div className="delete-topic-warning">
              <CircleAlert aria-hidden="true" />
              <p>
                <strong>This cannot be undone</strong>
                <span>
                  The decision, next action, owner and due date will be removed.
                  The discussion itself will be kept
                  {decisionPendingDelete?.bucket === 'history'
                    ? ' and moved to the backlog.'
                    : '.'}
                </span>
              </p>
            </div>
            <DialogFooter>
              <DialogClose
                render={
                  <Button
                    variant="ghost"
                    type="button"
                    disabled={pendingMutation === 'delete-decision'}
                  />
                }
              >
                Cancel
              </DialogClose>
              <Button
                variant="destructive"
                className="mutation-button"
                disabled={
                  workspaceStatus === 'saving' || pendingMutation !== null
                }
                aria-busy={pendingMutation === 'delete-decision'}
                onClick={() => void confirmDeleteDecision()}
              >
                {pendingMutation === 'delete-decision' ? (
                  <>
                    <LoaderCircle className="spin" aria-hidden="true" />
                    Deleting…
                  </>
                ) : (
                  <>
                    <Trash2 aria-hidden="true" />
                    Delete decision
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(discussionPendingDelete)}
          onOpenChange={(open) => {
            if (pendingMutation === 'delete-discussion') return;
            if (!open) setDiscussionPendingDelete(null);
          }}
        >
          <DialogContent className="form-dialog category-delete-dialog">
            <DialogHeader>
              <span className="signin-icon delete-topic-icon">
                <Trash2 aria-hidden="true" />
              </span>
              <DialogTitle>Delete this discussion?</DialogTitle>
              <DialogDescription>
                {discussionPendingDelete?.title || ''}
              </DialogDescription>
            </DialogHeader>
            <div className="delete-topic-warning">
              <CircleAlert aria-hidden="true" />
              <p>
                <strong>This cannot be undone</strong>
                <span>
                  The discussion and its recorded decision will be removed. Your
                  personal reminder settings will not be affected.
                </span>
              </p>
            </div>
            <DialogFooter>
              <DialogClose
                render={
                  <Button
                    variant="ghost"
                    type="button"
                    disabled={pendingMutation === 'delete-discussion'}
                  />
                }
              >
                Cancel
              </DialogClose>
              <Button
                variant="destructive"
                className="mutation-button"
                disabled={
                  workspaceStatus === 'saving' || pendingMutation !== null
                }
                aria-busy={pendingMutation === 'delete-discussion'}
                onClick={() => void confirmDeleteDiscussion()}
              >
                {pendingMutation === 'delete-discussion' ? (
                  <>
                    <LoaderCircle className="spin" aria-hidden="true" />
                    Deleting…
                  </>
                ) : (
                  <>
                    <Trash2 aria-hidden="true" />
                    Delete discussion
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent
            side="left"
            id="mobile-navigation"
            className="mobile-nav-sheet"
          >
            <SheetHeader>
              <SheetTitle>EMT Tracker</SheetTitle>
              <SheetDescription>Workspace navigation</SheetDescription>
            </SheetHeader>
            <Navigation
              activeView={activeView}
              backlogCount={backlog.length}
              decisionCount={recordedDecisions.length}
              onSelect={(view) => {
                selectView(view);
                setMobileNavOpen(false);
              }}
            />
          </SheetContent>
        </Sheet>

        <Sheet
          open={Boolean(selectedTopic)}
          onOpenChange={(open) => !open && setSelectedTopic(null)}
        >
          <SheetContent className="topic-sheet">
            {selectedTopic ? (
              <>
                <div className="topic-sheet-header">
                  <Badge className="topic-category">
                    {selectedTopic.category}
                  </Badge>
                  <SheetHeader>
                    <SheetTitle>{selectedTopic.title}</SheetTitle>
                    <SheetDescription>
                      Topic and decision record · shared workspace
                    </SheetDescription>
                  </SheetHeader>
                </div>
                <Tabs
                  className="topic-tabs"
                  value={activeTopicTab}
                  onValueChange={setActiveTopicTab}
                >
                  <TabsList
                    className="topic-tab-list"
                    aria-label="Topic record"
                  >
                    <TabsTrigger value="topic">Topic</TabsTrigger>
                    <TabsTrigger value="decision">Decision</TabsTrigger>
                  </TabsList>
                  <TabsContent
                    value="topic"
                    className="tab-panel tab-panel-with-footer"
                  >
                    <div className="decision-placeholder topic-edit-panel">
                      <LayoutList aria-hidden="true" />
                      <h3>Review and edit the topic</h3>
                      <p>
                        Update what will be discussed, its topic group, proposer
                        and meeting assignment.
                      </p>
                      <label className="decision-field" htmlFor="topic-title">
                        <span>Topic title</span>
                        <Input
                          id="topic-title"
                          value={topicDraft.title}
                          onChange={(event) =>
                            setTopicDraft((draft) => ({
                              ...draft,
                              title: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <div className="form-pair">
                        <label
                          className="decision-field"
                          htmlFor="topic-category"
                        >
                          <span>Topic</span>
                          <NativeSelect
                            id="topic-category"
                            value={topicDraft.category}
                            onChange={(event) =>
                              setTopicDraft((draft) => ({
                                ...draft,
                                category: event.target.value,
                              }))
                            }
                          >
                            {categories
                              .filter(
                                (category) =>
                                  category.active && !category.system,
                              )
                              .map((category) => (
                                <NativeSelectOption key={category.id}>
                                  {category.name}
                                </NativeSelectOption>
                              ))}
                          </NativeSelect>
                        </label>
                        <label
                          className="decision-field"
                          htmlFor="topic-proposer"
                        >
                          <span>Proposed by</span>
                          <NativeSelect
                            id="topic-proposer"
                            value={topicDraft.lead}
                            onChange={(event) =>
                              setTopicDraft((draft) => ({
                                ...draft,
                                lead: event.target.value,
                              }))
                            }
                          >
                            {members.map((member) => (
                              <NativeSelectOption key={member.email}>
                                {member.displayName}
                              </NativeSelectOption>
                            ))}
                          </NativeSelect>
                        </label>
                      </div>
                      {selectedTopic.bucket !== 'history' ? (
                        <label
                          className="decision-field"
                          htmlFor="topic-destination"
                        >
                          <span>Meeting assignment</span>
                          <NativeSelect
                            id="topic-destination"
                            value={topicDraft.destination}
                            onChange={(event) =>
                              setTopicDraft((draft) => ({
                                ...draft,
                                destination: event.target.value,
                              }))
                            }
                          >
                            {selectedTopic.meetingDate &&
                            !meetingSchedule.some(
                              (meeting) =>
                                meeting.iso === selectedTopic.meetingDate,
                            ) ? (
                              <NativeSelectOption
                                value={selectedTopic.meetingDate}
                              >
                                {meetingDateLong(selectedTopic.meetingDate)}
                              </NativeSelectOption>
                            ) : null}
                            {meetingSchedule.map((meeting) => (
                              <NativeSelectOption
                                value={meeting.iso}
                                key={meeting.iso}
                              >
                                {meeting.isToday ? 'Today' : meeting.longDate}
                              </NativeSelectOption>
                            ))}
                            <NativeSelectOption value="backlog">
                              Discussion backlog
                            </NativeSelectOption>
                          </NativeSelect>
                        </label>
                      ) : null}
                      <label className="decision-field" htmlFor="topic-context">
                        <span>Context for the meeting</span>
                        <Textarea
                          id="topic-context"
                          value={topicDraft.note}
                          onChange={(event) =>
                            setTopicDraft((draft) => ({
                              ...draft,
                              note: event.target.value,
                            }))
                          }
                          placeholder="Add the decision needed, useful links or preparation notes."
                        />
                      </label>
                    </div>
                    <SheetFooter className="topic-action-bar">
                      <Button
                        variant="destructive"
                        onClick={() =>
                          setDiscussionPendingDelete(selectedTopic)
                        }
                      >
                        <Trash2 aria-hidden="true" />
                        Delete discussion
                      </Button>
                      <Button
                        className="primary-action topic-save-action mutation-button"
                        disabled={
                          !topicDraft.title.trim() || pendingMutation !== null
                        }
                        aria-busy={pendingMutation === 'save-topic'}
                        onClick={() => void saveTopicDetails()}
                      >
                        {pendingMutation === 'save-topic' ? (
                          <>
                            <LoaderCircle className="spin" aria-hidden="true" />
                            Saving…
                          </>
                        ) : (
                          <>
                            <Check aria-hidden="true" />
                            Save topic
                          </>
                        )}
                      </Button>
                    </SheetFooter>
                  </TabsContent>
                  <TabsContent
                    value="decision"
                    className="tab-panel tab-panel-with-footer"
                  >
                    <div className="decision-placeholder">
                      <MessageSquareText aria-hidden="true" />
                      <h3>Review and edit the decision</h3>
                      <p>
                        Keep what was agreed, the owner, next action and due
                        date in one editable record.
                      </p>
                      {selectedTopic.decision ? (
                        <div className="saved-decision">
                          <div className="decision-status-heading">
                            <strong>Current decision</strong>
                            <FollowUpStatus
                              completedAt={selectedTopic.completedAt}
                            />
                          </div>
                          <span>{selectedTopic.decision}</span>
                          <small>
                            Next action:{' '}
                            {selectedTopic.followUpAction || 'Not added'}
                          </small>
                          <small>
                            Owner:{' '}
                            {selectedTopic.followUpOwner || 'Not assigned'} ·
                            Due: {formatDueDate(selectedTopic.dueDate)}
                          </small>
                          {selectedTopic.completedAt ? (
                            <small>
                              Completed{' '}
                              {new Intl.DateTimeFormat('en-AU', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                timeZone: MELBOURNE_TIME_ZONE,
                              }).format(new Date(selectedTopic.completedAt))}
                              {selectedTopic.completedBy
                                ? ` · ${members.find((member) => member.email === selectedTopic.completedBy)?.displayName || selectedTopic.completedBy}`
                                : ''}
                            </small>
                          ) : null}
                        </div>
                      ) : null}
                      <label
                        className="decision-field"
                        htmlFor="decision-rationale"
                      >
                        <span>Decision and rationale</span>
                        <Textarea
                          id="decision-rationale"
                          value={decisionDraft.decision}
                          onChange={(event) =>
                            setDecisionDraft((draft) => ({
                              ...draft,
                              decision: event.target.value,
                            }))
                          }
                          placeholder="What was agreed?"
                        />
                      </label>
                      <label
                        className="decision-field"
                        htmlFor="decision-action"
                      >
                        <span>Next action</span>
                        <Input
                          id="decision-action"
                          value={decisionDraft.followUpAction}
                          onChange={(event) =>
                            setDecisionDraft((draft) => ({
                              ...draft,
                              followUpAction: event.target.value,
                            }))
                          }
                          placeholder="What needs to happen next?"
                        />
                      </label>
                      <div className="form-pair">
                        <label
                          className="decision-field"
                          htmlFor="decision-owner"
                        >
                          <span>Follow-up owner</span>
                          <NativeSelect
                            id="decision-owner"
                            value={decisionDraft.followUpOwner}
                            onChange={(event) =>
                              setDecisionDraft((draft) => ({
                                ...draft,
                                followUpOwner: event.target.value,
                              }))
                            }
                          >
                            <NativeSelectOption value="">
                              Not assigned
                            </NativeSelectOption>
                            {members.map((member) => (
                              <NativeSelectOption key={member.email}>
                                {member.displayName}
                              </NativeSelectOption>
                            ))}
                          </NativeSelect>
                        </label>
                        <label
                          className="decision-field"
                          htmlFor="decision-due-date"
                        >
                          <span>Due date</span>
                          <Input
                            id="decision-due-date"
                            value={decisionDraft.dueDate}
                            onChange={(event) =>
                              setDecisionDraft((draft) => ({
                                ...draft,
                                dueDate: event.target.value,
                              }))
                            }
                            type="date"
                          />
                        </label>
                      </div>
                    </div>
                    <SheetFooter className="topic-action-bar decision-action-bar">
                      <div className="topic-delete-actions">
                        {selectedTopic.decision ? (
                          <Button
                            variant="destructive"
                            onClick={() =>
                              setDecisionPendingDelete(selectedTopic)
                            }
                          >
                            <Trash2 aria-hidden="true" />
                            Delete decision
                          </Button>
                        ) : null}
                        <Button
                          variant="destructive"
                          onClick={() =>
                            setDiscussionPendingDelete(selectedTopic)
                          }
                        >
                          <Trash2 aria-hidden="true" />
                          Delete discussion
                        </Button>
                      </div>
                      <div className="topic-primary-actions">
                        {selectedTopic.decision ? (
                          <Button
                            variant="outline"
                            className="completion-action mutation-button"
                            disabled={
                              pendingMutation !== null ||
                              !selectedTopic.followUpOwner ||
                              decisionDraft.decision !==
                                selectedTopic.decision ||
                              decisionDraft.followUpOwner !==
                                selectedTopic.followUpOwner ||
                              decisionDraft.followUpAction !==
                                selectedTopic.followUpAction ||
                              decisionDraft.dueDate !== selectedTopic.dueDate
                            }
                            title={
                              !selectedTopic.followUpOwner
                                ? 'Assign an owner and save the decision to mark complete.'
                                : 'Save any decision changes before updating completion.'
                            }
                            aria-busy={pendingMutation === 'set-completion'}
                            onClick={() => void toggleCompletion()}
                          >
                            {pendingMutation === 'set-completion' ? (
                              <LoaderCircle
                                className="spin"
                                aria-hidden="true"
                              />
                            ) : (
                              <CheckCircle2 aria-hidden="true" />
                            )}
                            {pendingMutation === 'set-completion'
                              ? 'Saving…'
                              : selectedTopic.completedAt
                                ? 'Reopen follow-up'
                                : 'Mark complete'}
                          </Button>
                        ) : null}
                        <Button
                          className="primary-action topic-save-action mutation-button"
                          disabled={pendingMutation !== null}
                          aria-busy={pendingMutation === 'save-decision'}
                          onClick={() => void saveDecision()}
                        >
                          {pendingMutation === 'save-decision' ? (
                            <>
                              <LoaderCircle
                                className="spin"
                                aria-hidden="true"
                              />
                              Saving…
                            </>
                          ) : (
                            <>
                              <Check aria-hidden="true" />
                              Save decision
                            </>
                          )}
                        </Button>
                      </div>
                    </SheetFooter>
                  </TabsContent>
                </Tabs>
              </>
            ) : null}
          </SheetContent>
        </Sheet>
      </div>
    </Toaster>
  );
}
