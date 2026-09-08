'use client';

import * as React from 'react';
import {
  Bell, CalendarDays, Check, CheckCircle2, ChevronRight, CircleAlert,
  ClipboardCheck, Clock3, LayoutList, LogIn, Mail, Menu,
  MessageSquareText, Plus, Search, Sparkles, UserRound, Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarProvider,
} from '@/components/ui/sidebar';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Toaster, toast } from '@/components/ui/toast';

type TopicStatus = 'Ready' | 'Needs owner' | 'In review';
type WorkspaceView = 'meeting' | 'backlog';
type Topic = {
  id: number; title: string; category: string; status: TopicStatus;
  lead: string; leadInitials: string; time: string; note: string; reminder: string;
  decision: string; followUpOwner: string; dueDate: string;
  remindLead: boolean; remindFollowup: boolean;
};

type WebMCPContext = {
  registerTool: (
    tool: {
      name: string;
      title: string;
      description: string;
      inputSchema: Record<string, unknown>;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => Promise<Record<string, unknown>>;
    },
    options?: { signal?: AbortSignal },
  ) => void | Promise<void>;
};

const initialTopics: Topic[] = [
  { id: 1, title: 'Confirm Q4 all-hands owners and format', category: 'People & culture', status: 'Ready', lead: 'Maya Chen', leadInitials: 'MC', time: '10 min', note: 'Agree the host, business updates and questions format before the October invitation is drafted.', reminder: '2 business days before meeting', decision: '', followUpOwner: '', dueDate: '', remindLead: false, remindFollowup: false },
  { id: 2, title: 'Review contract signing authority', category: 'Governance', status: 'In review', lead: 'Daniel Lee', leadInitials: 'DL', time: '15 min', note: 'Review current thresholds and decide whether the operating policy needs a 2026 update.', reminder: '1 business day before meeting', decision: '', followUpOwner: '', dueDate: '', remindLead: false, remindFollowup: false },
  { id: 3, title: 'Decide executive offsite planning lead', category: 'Operations', status: 'Needs owner', lead: 'Unassigned', leadInitials: '—', time: '8 min', note: 'Assign one lead to return with timing, location options and a proposed working agenda.', reminder: 'Not scheduled', decision: '', followUpOwner: '', dueDate: '', remindLead: false, remindFollowup: false },
  { id: 4, title: 'Approve shared leave coverage process', category: 'Operations', status: 'Ready', lead: 'Priya Shah', leadInitials: 'PS', time: '7 min', note: 'Confirm the minimum handover information and who owns the shared coverage calendar.', reminder: '2 business days before meeting', decision: '', followUpOwner: '', dueDate: '', remindLead: false, remindFollowup: false },
];

const initialBacklog: Topic[] = [
  { id: 101, title: 'Clarify quarterly recognition budget', category: 'Finance', status: 'Needs owner', lead: 'Unassigned', leadInitials: '—', time: '10 min', note: 'Confirm the decision owner and the budget information needed before this moves to a meeting.', reminder: 'Not scheduled', decision: '', followUpOwner: '', dueDate: '', remindLead: false, remindFollowup: false },
  { id: 102, title: 'Review after-hours office access policy', category: 'Operations', status: 'Ready', lead: 'Priya Shah', leadInitials: 'PS', time: '10 min', note: 'Review whether the current process still matches the team’s operating pattern.', reminder: 'Not scheduled', decision: '', followUpOwner: '', dueDate: '', remindLead: false, remindFollowup: false },
];

const secondaryNavItems = [
  { label: 'Decisions', icon: ClipboardCheck, count: 12 },
  { label: 'People & ownership', icon: Users },
  { label: 'Reminder settings', icon: Bell },
];

function StatusBadge({ status }: { status: TopicStatus }) {
  const Icon = status === 'Ready' ? CheckCircle2 : CircleAlert;
  return <Badge className={`status-badge status-${status.toLowerCase().replace(' ', '-')}`}><Icon aria-hidden="true" />{status}</Badge>;
}

function Navigation({ activeView, backlogCount, onSelect }: { activeView: WorkspaceView; backlogCount: number; onSelect: (view: WorkspaceView) => void }) {
  return (
    <SidebarContent className="nav-content">
      <SidebarGroup className="nav-group"><SidebarGroupContent>
        <SidebarMenu className="nav-menu">
          {[
            { label: 'Next meeting', icon: CalendarDays, view: 'meeting' as WorkspaceView },
            { label: 'Discussion backlog', icon: LayoutList, view: 'backlog' as WorkspaceView, count: backlogCount },
          ].map(({ label, icon: Icon, view, count }) => (
            <SidebarMenuItem key={label}>
              <SidebarMenuButton isActive={activeView === view} className="nav-button" onClick={() => onSelect(view)}>
                <Icon aria-hidden="true" /><span>{label}</span>
                {count ? <span className="nav-count">{count}</span> : null}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          {secondaryNavItems.map(({ label, icon: Icon, count }) => (
            <SidebarMenuItem key={label}>
              <SidebarMenuButton className="nav-button" onClick={() => toast.add({ type: 'info', title: `${label} preview`, description: 'This mockup keeps that workflow inside each discussion drawer.' })}>
                <Icon aria-hidden="true" /><span>{label}</span>{count ? <span className="nav-count">{count}</span> : null}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent></SidebarGroup>
      <div className="nav-foot"><span className="sample-dot" /><span>Sample workspace</span></div>
    </SidebarContent>
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
  const [newTitle, setNewTitle] = React.useState('');
  const [newCategory, setNewCategory] = React.useState('Operations');
  const [newLead, setNewLead] = React.useState('Unassigned');
  const [newContext, setNewContext] = React.useState('');
  const [newDestination, setNewDestination] = React.useState<WorkspaceView>('meeting');
  const [decisionDraft, setDecisionDraft] = React.useState({ decision: '', followUpOwner: '', dueDate: '' });
  const [search, setSearch] = React.useState('');
  const filteredTopics = topics.filter((topic) => `${topic.title} ${topic.category} ${topic.lead}`.toLowerCase().includes(search.toLowerCase()));
  const readyCount = topics.filter((topic) => topic.status === 'Ready').length;
  const totalMinutes = topics.reduce((sum, topic) => sum + Number.parseInt(topic.time, 10), 0);

  React.useEffect(() => {
    const context = (document as Document & { modelContext?: WebMCPContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();

    void Promise.resolve(context.registerTool({
      name: 'stage_discussion',
      title: 'Stage a discussion',
      description: 'Add a sample discussion to the visible GMS executive meeting agenda. This changes only the current mockup session.',
      inputSchema: {
        type: 'object',
        properties: { title: { type: 'string', minLength: 1, maxLength: 120 } },
        required: ['title'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        const value = input as { title?: unknown };
        if (typeof value?.title !== 'string' || !value.title.trim() || value.title.trim().length > 120) {
          throw new Error('Provide a discussion title between 1 and 120 characters.');
        }
        const topic: Topic = { id: Date.now(), title: value.title.trim(), category: 'Operations', status: 'Needs owner', lead: 'Unassigned', leadInitials: '—', time: '10 min', note: 'New sample discussion staged by a browser tool.', reminder: 'Not scheduled', decision: '', followUpOwner: '', dueDate: '', remindLead: false, remindFollowup: false };
        setTopics((current) => [...current, topic]);
        return { id: topic.id, status: 'staged', mock: true };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);

    return () => lifecycle.abort();
  }, []);

  function addTopic(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    const topic: Topic = { id: Date.now(), title, category: newCategory, status: newLead === 'Unassigned' ? 'Needs owner' : 'Ready', lead: newLead, leadInitials: newLead === 'Unassigned' ? '—' : newLead.split(' ').map((part) => part[0]).join(''), time: '10 min', note: newContext.trim() || 'No preparation context has been added yet.', reminder: 'Not scheduled', decision: '', followUpOwner: '', dueDate: '', remindLead: false, remindFollowup: false };
    if (newDestination === 'backlog') setBacklog((current) => [...current, topic]);
    else setTopics((current) => [...current, topic]);
    setNewTitle(''); setNewContext(''); setNewLead('Unassigned'); setNewCategory('Operations'); setAddOpen(false);
    toast.add({ type: 'success', title: 'Discussion added', description: newDestination === 'backlog' ? 'It is now in the discussion backlog.' : 'It is now on the sample agenda.' });
  }

  function openTopic(topic: Topic) {
    setSelectedTopic(topic);
    setDecisionDraft({ decision: topic.decision, followUpOwner: topic.followUpOwner, dueDate: topic.dueDate });
  }

  function updateTopic(updated: Topic) {
    setTopics((current) => current.map((topic) => topic.id === updated.id ? updated : topic));
    setBacklog((current) => current.map((topic) => topic.id === updated.id ? updated : topic));
    setSelectedTopic(updated);
  }

  function assignLead(lead: string) {
    if (!selectedTopic) return;
    updateTopic({ ...selectedTopic, lead, leadInitials: lead === 'Unassigned' ? '—' : lead.split(' ').map((part) => part[0]).join(''), status: lead === 'Unassigned' ? 'Needs owner' : 'Ready' });
    toast.add({ type: 'success', title: 'Lead updated', description: lead === 'Unassigned' ? 'This discussion still needs an owner.' : `${lead} now leads this discussion.` });
  }

  function saveDecision() {
    if (!selectedTopic) return;
    updateTopic({ ...selectedTopic, ...decisionDraft });
    toast.add({ type: 'success', title: 'Decision saved', description: 'The decision and follow-up are now visible in this mockup session.' });
  }

  function moveToAgenda(topic: Topic) {
    setBacklog((current) => current.filter((item) => item.id !== topic.id));
    setTopics((current) => [...current, topic]);
    toast.add({ type: 'success', title: 'Moved to next meeting', description: topic.title });
  }

  function simulateSignIn() {
    setSignedIn(true); setSignInOpen(false);
    toast.add({ type: 'success', title: 'Microsoft account connected', description: 'Simulation only — no real account or mailbox was accessed.' });
  }

  return (
    <Toaster><div className="app-shell">
      <header className="brand-header">
        <div className="brand-lockup">
          <img src="/assets/gms-logo-white.png" alt="GMS 10 Years" className="gms-logo" />
          <span className="brand-divider" aria-hidden="true" /><span className="product-name">Executive Projects</span>
        </div>
        <div className="header-actions">
          <Badge className="demo-badge">Interactive mockup</Badge>
          <Button variant="ghost" className={`microsoft-button ${signedIn ? 'is-connected' : ''}`} onClick={() => setSignInOpen(true)}>
            {signedIn ? <Check aria-hidden="true" /> : <LogIn aria-hidden="true" />}
            <span>{signedIn ? 'Microsoft connected' : 'Sign in with Microsoft'}</span>
          </Button>
        </div>
      </header>

      <SidebarProvider className="workspace-provider"><div className="workspace-layout">
        <Sidebar collapsible="none" className="workspace-sidebar"><Navigation activeView={activeView} backlogCount={backlog.length} onSelect={setActiveView} /></Sidebar>
        <main className="workspace-main" id="workspace-main">
          <div className="mobile-topbar">
            <Button variant="outline" className="mobile-menu-button" aria-expanded={mobileNavOpen} aria-controls="mobile-navigation" onClick={() => setMobileNavOpen(true)}><Menu aria-hidden="true" />Menu</Button>
            <Badge className="demo-badge mobile-demo">Mockup</Badge>
          </div>
          {activeView === 'meeting' ? <><section className="meeting-intro" aria-labelledby="meeting-title">
            <div>
              <p className="meeting-date">Thursday, 17 September 2026 · 9:30–10:30 AM</p>
              <h1 id="meeting-title">Next executive meeting</h1>
              <p className="intro-copy">Shape the agenda, name a lead and leave every discussion with a clear next move.</p>
            </div>
            <Button className="primary-action" size="lg" onClick={() => { setNewDestination('meeting'); setAddOpen(true); }}><Plus aria-hidden="true" />Add discussion</Button>
          </section>

          <div className="content-grid">
            <section className="agenda-panel" aria-labelledby="agenda-heading">
              <div className="panel-toolbar"><div><h2 id="agenda-heading">Agenda</h2><p>{topics.length} discussions · {totalMinutes} minutes planned</p></div>
                <label className="search-field"><Search aria-hidden="true" /><span className="sr-only">Search agenda</span><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search agenda" /></label>
              </div>
              <div className="agenda-list">
                {filteredTopics.map((topic, index) => (
                  <button type="button" className="agenda-row" key={topic.id} onClick={() => openTopic(topic)}>
                    <span className="agenda-order">{String(index + 1).padStart(2, '0')}</span>
                    <span className="agenda-summary"><span className="agenda-topline"><span className="agenda-title">{topic.title}</span><StatusBadge status={topic.status} /></span>
                      <span className="agenda-meta"><span>{topic.category}</span><span className="meta-dot" aria-hidden="true" /><span className={topic.lead === 'Unassigned' ? 'needs-owner' : ''}>{topic.lead}</span></span>
                    </span>
                    <span className="agenda-duration"><Clock3 aria-hidden="true" />{topic.time}</span><ChevronRight className="row-chevron" aria-hidden="true" />
                  </button>
                ))}
                {filteredTopics.length === 0 ? <div className="empty-state"><Search aria-hidden="true" /><strong>No matching discussions</strong><span>Try another title, category or owner.</span></div> : null}
              </div>
            </section>

            <aside className="meeting-rail" aria-label="Meeting readiness">
              <section className="readiness-panel">
                <div className="readiness-tally" aria-label={`${readyCount} of ${topics.length} discussions ready`}><strong>{readyCount} ready</strong><span>{topics.length - readyCount} to review</span></div>
                <div><h2>Meeting readiness</h2><p>{topics.length - readyCount} items still need attention before the agenda can be sent.</p></div>
                <div className="readiness-checks"><div className="check-row is-done"><Check aria-hidden="true" /><span>Meeting time confirmed</span></div><div className="check-row is-done"><Check aria-hidden="true" /><span>Draft agenda created</span></div><div className="check-row"><CircleAlert aria-hidden="true" /><span>Assign one discussion lead</span></div></div>
                <Button variant="secondary" className="send-agenda-button" onClick={() => toast.add({ type: 'info', title: 'Agenda preview ready', description: 'Sending is disabled in this mockup.' })}><Mail aria-hidden="true" />Preview agenda email</Button>
              </section>
              <section className="reminder-panel">
                <div className="reminder-heading"><span className="icon-tile"><Bell aria-hidden="true" /></span><div><h2>Outlook reminders</h2><p>Drafted for every lead</p></div></div>
                <div className="switch-row"><div><strong>Automatic reminders</strong><span>{signedIn ? '2 business days before' : 'Connect Microsoft to activate'}</span></div><Switch checked={signedIn && remindersOn} disabled={!signedIn} onCheckedChange={setRemindersOn} aria-label="Automatic reminders" /></div>
                <div className="next-reminder"><CalendarDays aria-hidden="true" /><div><span>Next reminder</span><strong>{!signedIn ? 'Waiting for Microsoft connection' : remindersOn ? 'Tuesday, 15 September · 9:30 AM' : 'Paused'}</strong></div></div>
                <p className="mock-note">Simulation only — no email or calendar event will be created.</p>
              </section>
            </aside>
          </div></> : <section className="backlog-view" aria-labelledby="backlog-title">
            <div className="meeting-intro"><div><p className="meeting-date">Topics waiting for a future agenda</p><h1 id="backlog-title">Discussion backlog</h1><p className="intro-copy">Assign a lead and move a topic into the next meeting when it is ready.</p></div><Button className="primary-action" size="lg" onClick={() => { setNewDestination('backlog'); setAddOpen(true); }}><Plus aria-hidden="true" />Add to backlog</Button></div>
            <section className="agenda-panel backlog-panel"><div className="panel-toolbar"><div><h2>Waiting for discussion</h2><p>{backlog.length} sample topics</p></div></div><div className="agenda-list">
              {backlog.map((topic, index) => <div className="backlog-row" key={topic.id}><button type="button" className="backlog-open" onClick={() => openTopic(topic)}><span className="agenda-order">{String(index + 1).padStart(2, '0')}</span><span className="agenda-summary"><span className="agenda-topline"><span className="agenda-title">{topic.title}</span><StatusBadge status={topic.status} /></span><span className="agenda-meta"><span>{topic.category}</span><span className="meta-dot" aria-hidden="true" /><span className={topic.lead === 'Unassigned' ? 'needs-owner' : ''}>{topic.lead}</span></span></span></button><Button variant="secondary" onClick={() => moveToAgenda(topic)}>Move to next meeting</Button></div>)}
              {backlog.length === 0 ? <div className="empty-state"><CheckCircle2 aria-hidden="true" /><strong>Backlog cleared</strong><span>Every discussion has been placed on an agenda.</span></div> : null}
            </div></section>
          </section>}
        </main>
      </div></SidebarProvider>

      <Dialog open={addOpen} onOpenChange={setAddOpen}><DialogContent className="form-dialog"><form onSubmit={addTopic}>
        <DialogHeader><DialogTitle>Add a discussion</DialogTitle><DialogDescription>Put it on the next agenda now. You can refine the owner and reminder later.</DialogDescription></DialogHeader>
        <div className="form-stack"><label><span>Discussion title</span><Input autoFocus value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="What needs a decision?" required /></label>
          <label><span>Destination</span><NativeSelect value={newDestination} onChange={(event) => setNewDestination(event.target.value as WorkspaceView)}><NativeSelectOption value="meeting">Next executive meeting</NativeSelectOption><NativeSelectOption value="backlog">Discussion backlog</NativeSelectOption></NativeSelect></label>
          <div className="form-pair"><label><span>Category</span><NativeSelect value={newCategory} onChange={(event) => setNewCategory(event.target.value)}><NativeSelectOption>Operations</NativeSelectOption><NativeSelectOption>People & culture</NativeSelectOption><NativeSelectOption>Governance</NativeSelectOption><NativeSelectOption>Finance</NativeSelectOption></NativeSelect></label>
            <label><span>Lead</span><NativeSelect value={newLead} onChange={(event) => setNewLead(event.target.value)}><NativeSelectOption>Unassigned</NativeSelectOption><NativeSelectOption>Maya Chen</NativeSelectOption><NativeSelectOption>Daniel Lee</NativeSelectOption><NativeSelectOption>Priya Shah</NativeSelectOption></NativeSelect></label></div>
          <label><span>Context for the meeting</span><Textarea value={newContext} onChange={(event) => setNewContext(event.target.value)} placeholder="Add the decision needed, useful links or preparation notes." /></label>
        </div>
        <DialogFooter><DialogClose render={<Button variant="ghost" type="button" />}>Cancel</DialogClose><Button type="submit" className="primary-action">Add to agenda</Button></DialogFooter>
      </form></DialogContent></Dialog>

      <Dialog open={signInOpen} onOpenChange={setSignInOpen}><DialogContent className="signin-dialog">
        <DialogHeader><span className="signin-icon"><LogIn aria-hidden="true" /></span><DialogTitle>{signedIn ? 'Microsoft connection' : 'Connect your Microsoft account'}</DialogTitle><DialogDescription>{signedIn ? 'This mock account shows how the live connection could be managed.' : 'The live product would request permission to sign you in and prepare Outlook reminders and calendar context.'}</DialogDescription></DialogHeader>
        <div className="permission-list"><div><UserRound aria-hidden="true" /><span><strong>Basic profile</strong><small>Identify you inside the executive workspace</small></span></div><div><Mail aria-hidden="true" /><span><strong>Outlook mail</strong><small>Prepare reminder messages for assigned leads</small></span></div><div><CalendarDays aria-hidden="true" /><span><strong>Calendar</strong><small>Connect the fortnightly meeting and due dates</small></span></div></div>
        <p className="mock-note">This is a safe simulation. No Microsoft sign-in will open and no permissions are requested.</p>
        <DialogFooter><DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose><Button className="primary-action" onClick={simulateSignIn}>{signedIn ? 'Done' : 'Simulate Microsoft sign-in'}</Button></DialogFooter>
      </DialogContent></Dialog>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}><SheetContent side="left" id="mobile-navigation" className="mobile-nav-sheet"><SheetHeader><SheetTitle>Executive Projects</SheetTitle><SheetDescription>Workspace navigation</SheetDescription></SheetHeader><Navigation activeView={activeView} backlogCount={backlog.length} onSelect={(view) => { setActiveView(view); setMobileNavOpen(false); }} /></SheetContent></Sheet>

      <Sheet open={Boolean(selectedTopic)} onOpenChange={(open) => !open && setSelectedTopic(null)}><SheetContent className="topic-sheet">
        {selectedTopic ? <><div className="topic-sheet-header"><Badge className="topic-category">{selectedTopic.category}</Badge><SheetHeader><SheetTitle>{selectedTopic.title}</SheetTitle><SheetDescription>Fortnightly executive meeting · sample discussion</SheetDescription></SheetHeader></div>
          <Tabs defaultValue="overview" className="topic-tabs"><TabsList className="topic-tab-list"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="decision">Decision</TabsTrigger><TabsTrigger value="reminders">Reminders</TabsTrigger></TabsList>
            <TabsContent value="overview" className="tab-panel"><StatusBadge status={selectedTopic.status} /><p className="topic-note">{selectedTopic.note}</p><label className="owner-control"><span>Discussion lead</span><NativeSelect value={selectedTopic.lead} onChange={(event) => assignLead(event.target.value)}><NativeSelectOption>Unassigned</NativeSelectOption><NativeSelectOption>Maya Chen</NativeSelectOption><NativeSelectOption>Daniel Lee</NativeSelectOption><NativeSelectOption>Priya Shah</NativeSelectOption></NativeSelect></label><div className="detail-grid"><div><span>Agenda time</span><strong>{selectedTopic.time}</strong></div><div><span>Reminder</span><strong>{signedIn && remindersOn && selectedTopic.remindLead ? selectedTopic.reminder : 'Not active'}</strong></div><div><span>Decision state</span><strong>{selectedTopic.decision ? 'Recorded' : 'Pending meeting'}</strong></div><div><span>Follow-up</span><strong>{selectedTopic.followUpOwner || 'Not assigned'}</strong></div></div></TabsContent>
            <TabsContent value="decision" className="tab-panel"><div className="decision-placeholder"><MessageSquareText aria-hidden="true" /><h3>Capture the decision in the meeting</h3><p>Record what was agreed, the follow-up owner and the due date in one place.</p>{selectedTopic.decision ? <div className="saved-decision"><strong>Saved decision</strong><span>{selectedTopic.decision}</span><small>Follow-up: {selectedTopic.followUpOwner || 'Not assigned'} · Due: {selectedTopic.dueDate || 'Not set'}</small></div> : null}<Textarea value={decisionDraft.decision} onChange={(event) => setDecisionDraft((draft) => ({ ...draft, decision: event.target.value }))} placeholder="Decision and rationale" /><div className="form-pair"><Input value={decisionDraft.followUpOwner} onChange={(event) => setDecisionDraft((draft) => ({ ...draft, followUpOwner: event.target.value }))} placeholder="Follow-up owner" /><Input value={decisionDraft.dueDate} onChange={(event) => setDecisionDraft((draft) => ({ ...draft, dueDate: event.target.value }))} type="date" aria-label="Follow-up due date" /></div><Button className="primary-action" onClick={saveDecision}><Check aria-hidden="true" />Save decision</Button></div></TabsContent>
            <TabsContent value="reminders" className="tab-panel"><div className="reminder-setting-row"><div><Bell aria-hidden="true" /><span><strong>Lead reminder</strong><small>{signedIn && remindersOn ? 'Send before the meeting' : signedIn ? 'Automatic reminders are paused' : 'Connect Microsoft to activate'}</small></span></div><Switch checked={signedIn && remindersOn && selectedTopic.remindLead} disabled={!signedIn || !remindersOn} onCheckedChange={(checked) => updateTopic({ ...selectedTopic, remindLead: checked })} aria-label="Lead reminder" /></div><div className="reminder-setting-row"><div><ClipboardCheck aria-hidden="true" /><span><strong>Follow-up reminder</strong><small>{signedIn && remindersOn ? 'Send before the action due date' : signedIn ? 'Automatic reminders are paused' : 'Connect Microsoft to activate'}</small></span></div><Switch checked={signedIn && remindersOn && selectedTopic.remindFollowup} disabled={!signedIn || !remindersOn} onCheckedChange={(checked) => updateTopic({ ...selectedTopic, remindFollowup: checked })} aria-label="Follow-up reminder" /></div><div className="integration-callout"><Sparkles aria-hidden="true" /><p><strong>{signedIn ? 'Microsoft Graph connected' : 'Microsoft Graph connection needed'}</strong><span>{signedIn ? remindersOn ? 'Reminder preferences are active in this mock session.' : 'The Microsoft connection is ready, but automatic reminders are paused.' : 'The production version would request delegated work-account permissions under your organisation’s security policy.'}</span></p></div></TabsContent>
          </Tabs></> : null}
      </SheetContent></Sheet>
    </div></Toaster>
  );
}
