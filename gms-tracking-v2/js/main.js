/* App shell — chrome, routing, filters, and the one re-render everything calls. */

import { APP, SUPABASE, PLATFORM_COLOR } from './config.js';
import { el, fill, clear, monthLabel, dateAu, toast, tip } from './dom.js';
import * as store from './store.js';
import { buildRows, facets, monthsAvailable, emptyFilters } from './model.js';
import { renderTracking } from './view-tracking.js';
import { renderClients } from './view-clients.js';
import { renderSpend } from './view-spend.js';
import { renderImport } from './view-import.js';
import { renderAdmin } from './view-admin.js';
import { renderMonthly } from './view-monthly.js';
import { exportBackup } from './exportxlsx.js';
import { openExport, closeExport } from './view-export.js';
import { dialog } from './modal.js';
import { ymOf, todayIso } from './calc.js';
import { closeDrawer } from './drawer.js';

const NAV = [
  { id: 'update', label: 'Update Spend', defaultTab: 'spend', tabs: [['spend', 'Platform update']] },
  { id: 'plans', label: 'Plans', defaultTab: 'clients', tabs: [
    ['clients', 'Clients'], ['monthly', 'Monthly pacing'], ['tracking', 'Overview'],
  ] },
  { id: 'admin', label: 'Admin', defaultTab: 'import', tabs: [
    ['import', 'Add campaign'], ['admin', 'Settings'],
  ] },
];

const state = {
  tab: 'spend',
  view: 'internal',
  ym: ymOf(todayIso()),
  filters: emptyFilters(),
  planClient: '',
  planCampaign: '',
  spendMode: 'month',
  spendDate: '',
  theme: localStorage.getItem('tracking-theme') || '',
};

const root = document.getElementById('root');

/* ------------------------------------------------------------------ boot */

/* --------------------------------------------------- someone else's edit */

/**
 * A colleague's change lands in the store but not on the screen: the only
 * store listener used to repaint the sync chip and nothing else, so two people
 * tracking at once each saw their own stale numbers until they happened to
 * click something. Now a remote change repaints the page — carefully.
 *
 * Carefully, because a rebuild replaces every input. render() restores scroll
 * and focus, but a value typed and not yet committed (onchange fires on blur
 * or Enter) lives only in the DOM node being thrown away. So a repaint waits
 * while the cursor is in a field, and runs when it leaves.
 */
const REMOTE_SETTLE_MS = 400;   // a colleague's save arrives as a burst of rows
let remoteDirty = false;
let remoteTimer = null;

const isTyping = () => {
  const el = document.activeElement;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
};

function flushRemote() {
  if (!remoteDirty || isTyping()) return;
  remoteDirty = false;
  render();
}

function noteRemoteChange() {
  remoteDirty = true;
  clearTimeout(remoteTimer);
  remoteTimer = setTimeout(flushRemote, REMOTE_SETTLE_MS);
}

/* Leaving a field is the moment a deferred repaint becomes safe. The small
   delay lets the field's own onchange commit first, so its write is in the
   store before the page is rebuilt from it. */
document.addEventListener('focusout', () => setTimeout(flushRemote, 80));

(async function boot() {
  if (state.theme) document.documentElement.dataset.theme = state.theme;
  readUrl();
  await store.init();
  store.onChange((info) => { paintStatus(); if (info?.remote) noteRemoteChange(); });
  render();
}());

/* -------------------------------------------------------------- url state */

function readUrl() {
  const p = new URLSearchParams(location.hash.slice(1));
  if (p.get('tab')) state.tab = p.get('tab');
  if (p.get('view')) state.view = p.get('view');
  if (p.has('ym')) state.ym = p.get('ym');
  if (p.get('planClient')) state.planClient = p.get('planClient');
  if (p.get('planCampaign')) state.planCampaign = p.get('planCampaign');
  for (const k of Object.keys(state.filters)) if (p.get(k)) state.filters[k] = p.get(k);
}

function writeUrl() {
  const p = new URLSearchParams();
  p.set('tab', state.tab);
  p.set('view', state.view);
  p.set('ym', state.ym || '');
  if (state.planClient) p.set('planClient', state.planClient);
  if (state.planCampaign) p.set('planCampaign', state.planCampaign);
  for (const [k, v] of Object.entries(state.filters)) if (v) p.set(k, v);
  history.replaceState(null, '', '#' + p.toString());
}

/* ---------------------------------------------------------------- render */

let rows = [];
let renderedTab = null;

function render() {
  if (store.state.status === 'locked') { renderGate(); return; }

  /* The whole page is rebuilt on every change, which is what keeps every
     derived figure honest — but a rebuild resets scroll to the top and drops
     focus, so typing a number in row 40 flung the view back to row 1. The
     position and the focused cell are captured here and put back after the
     rebuild; inputs carry a stable data-focus key so "the same cell" survives
     its own DOM being replaced. */
  const scrollY = window.scrollY;
  /* A horizontal position belongs to one view. Carrying Tracking Entry's
     far-right Actions position into Overview shifts its first table sideways. */
  const panes = renderedTab === state.tab
    ? [...document.querySelectorAll('.tablewrap')].map((w) => w.scrollLeft)
    : [];
  const focusKey = document.activeElement?.dataset?.focus;
  /* Where the focused cell sat in the viewport — restoring THIS, rather than
     the page offset, is what makes the browser's "reveal the focused element"
     scroll a no-op: the element is already exactly where it was. */
  const focusTop = focusKey ? document.activeElement.getBoundingClientRect().top : 0;

  pruneStaleFilters();
  writeUrl();
  /* A platform session must include every line visible in that ad account,
     not only lines with a budget row in the month currently used by Overview. */
  rows = buildRows(state.tab === 'spend' ? { ...state, ym: null } : state);

  /* fill() returns the container it filled, not the child — appending to its
     return value put the whole page outside .app, which is why the gutter and
     the max-width never appeared. */
  const app = el('div', { class: 'app' });
  fill(root, app);
  app.appendChild(topbar());
  app.appendChild(primaryNav());
  app.appendChild(secondaryNav());
  app.appendChild(confidBand());

  if (!['admin', 'import', 'monthly', 'clients', 'spend'].includes(state.tab)) {
    app.appendChild(period());
    app.appendChild(filterBar());
  }

  const view = el('div', { class: 'view' });
  app.appendChild(view);
  const ctx = { rows, state, rerender: render, goTo, openPlan };
  if (state.tab === 'tracking') renderTracking(view, ctx);
  else if (state.tab === 'clients') renderClients(view, ctx);
  else if (state.tab === 'monthly') renderMonthly(view, ctx);
  else if (state.tab === 'spend') {
    view.appendChild(platformLauncher());
    if (state.filters.platform) renderSpend(view, ctx);
  }
  else if (state.tab === 'import') renderImport(view, ctx);
  else renderAdmin(view, ctx);
  renderedTab = state.tab;

  app.appendChild(footer());

  /* Put the reader back where they were. Focus first, then pin the offsets —
     and pin them AGAIN one frame later, because both scroll anchoring and the
     browser's own focus handling like to re-scroll asynchronously after a DOM
     swap, and whoever scrolls last wins. */
  [...app.querySelectorAll('.tablewrap')].forEach((w, i) => { w.scrollLeft = panes[i] || 0; });
  const back = focusKey && app.querySelector(`[data-focus="${CSS.escape(focusKey)}"]`);
  if (back) {
    /* Scroll so the rebuilt cell lands at the exact viewport position its
       predecessor occupied, THEN focus. The browser's asynchronous "reveal
       the focused element" scroll — which ignores preventScroll's guarantee
       beyond the call itself, and outlasts any pin — finds the element
       already fully in view and has nothing to do. Fighting that reveal with
       timers loses; making it a no-op cannot. */
    window.scrollTo(0, Math.max(0, back.getBoundingClientRect().top + window.scrollY - focusTop));
    back.focus({ preventScroll: true });
  } else {
    window.scrollTo(0, scrollY);
  }
}

function goTo(tab) {
  const from = state.tab;
  state.tab = tab;
  /* A campaign can have no booking in the calendar month last used by the
     portfolio chart. Entering Overview from Plans should show the selected
     plan across its flight, not a misleading empty state. */
  if (tab === 'tracking' && ['clients', 'monthly'].includes(from)) state.ym = '';
  closeDrawer();
  closeExport();
  render();
}

function openPlan(clientId = '', campaignId = '') {
  state.tab = 'clients';
  state.planClient = clientId || '';
  state.planCampaign = campaignId || '';
  closeDrawer();
  closeExport();
  render();
}

/**
 * A client or campaign filter is stored as an id. If that id no longer exists
 * — a URL kept from the sample data, or a campaign since removed — the select
 * falls back to showing "All" while the filter quietly removes every row. The
 * page then looks empty for no visible reason, which is worse than wrong.
 */
let staleNotice = '';
function pruneStaleFilters() {
  const gone = [];
  if (state.filters.client && !store.byId('client', state.filters.client)) {
    gone.push('client'); state.filters.client = '';
  }
  if (state.filters.campaign && !store.byId('campaign', state.filters.campaign)) {
    gone.push('campaign'); state.filters.campaign = '';
  }
  const planClient = state.planClient && store.byId('client', state.planClient);
  const planCampaign = state.planCampaign && store.byId('campaign', state.planCampaign);
  if (state.planClient && !planClient) {
    state.planClient = '';
    state.planCampaign = '';
  } else if (state.planCampaign
    && (!planCampaign || planCampaign.client_id !== state.planClient)) {
    state.planCampaign = '';
  }
  staleNotice = gone.length
    ? `A saved ${gone.join(' and ')} filter pointed at something that is no longer here, so it was cleared.`
    : '';
}

/* ------------------------------------------------------------------ gate */

/**
 * The password is checked by Supabase Auth against a real account, not by
 * anything in this page — so it protects the data, not just the screen.
 *
 * The field lives in a real <form> with an off-screen username input: without
 * one, Chrome's password manager hunts the page for something to autofill and
 * lands on whatever text input it finds. (The UQ dashboard lost an afternoon
 * to exactly that — autofill silently filled its search box.)
 */
function renderGate() {
  const pw = el('input', {
    type: 'password', autocomplete: 'current-password', required: true,
    placeholder: 'Team password', 'aria-label': 'Team password',
  });
  const msg = el('div', { class: 'hint', style: { minHeight: '18px', color: 'var(--crit)' } });
  const btn = el('button', { class: 'btn primary', type: 'submit', style: { width: '100%' } }, 'Sign in');

  const form = el('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      btn.disabled = true; fill(msg, 'Checking…'); msg.style.color = 'var(--ink-3)';
      const r = await store.signIn(pw.value);
      btn.disabled = false;
      pw.value = '';
      if (r.ok) { render(); return; }
      msg.style.color = 'var(--crit)';
      fill(msg, r.error === 'Invalid login credentials' ? 'That password is not right.' : r.error);
    },
  },
  el('input', {
    type: 'email', value: SUPABASE.teamEmail, autocomplete: 'username',
    tabindex: '-1', 'aria-hidden': 'true', readonly: true,
    style: { position: 'absolute', left: '-9999px', width: '1px', height: '1px' },
  }),
  el('div', { class: 'field' }, el('label', {}, 'Team password'), pw),
  msg, btn);

  fill(root, el('div', { class: 'gate' }, el('div', { class: 'box' },
    el('div', { class: 'plate', style: { display: 'inline-flex', marginBottom: '16px' } },
      el('img', { src: 'assets/gms-logo.png', alt: 'GMS' }),
      el('span', { class: 'rule' }),
      el('span', { class: 'mark' }, 'DIGITAL')),
    el('h2', { style: { margin: '0 0 4px', fontSize: '18px', fontWeight: 700 } }, APP.title),
    /* Signed-out copy stays deliberately blank about what is inside. This
       screen is reachable by anyone with the URL; describing the contents
       would advertise them. The INTERNAL banner after sign-in does that job,
       to an audience that is already allowed to see it. */
    el('p', { class: 'muted', style: { margin: '0 0 18px', fontSize: '12.5px' } },
      'GMS internal only'),
    form,
    el('div', { style: { marginTop: '14px' } },
      tip('If you need access, ask Coco.', 'Access help')))));
  setTimeout(() => pw.focus(), 30);
}

/* ---------------------------------------------------------------- chrome */

let statusChip = null;

function topbar() {
  /* Clickable, because "Offline" on its own tells a colleague nothing about
     whether to keep typing. The reason was already captured; it was only ever
     in a tooltip, which is not where someone looks when something is wrong. */
  statusChip = el('span', {
    class: 'chip', role: 'button', tabindex: '0',
    onclick: () => syncDetail(),
    onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); syncDetail(); } },
  }, el('span', { class: 'dot' }), 'ready');
  paintStatus();

  return el('div', { class: 'topbar' },
    el('div', { class: 'plate' },
      el('img', { src: 'assets/gms-logo.png', alt: 'GMS' }),
      el('span', { class: 'rule' }),
      el('span', { class: 'mark' }, 'DIGITAL')),
    el('div', { class: 'titles' },
      el('h1', {}, APP.title, el('span', { class: 'v2-version' }, 'V2'), tip(APP.sub, 'Dashboard purpose'))),
    el('div', { class: 'spacer' }),

    el('div', { class: 'seg audience-seg', role: 'group', 'aria-label': 'Which figures to show' },
      el('button', {
        'aria-pressed': state.view === 'internal',
        onclick: () => { state.view = 'internal'; render(); },
      }, 'Internal'),
      el('button', {
        class: 'client', 'aria-pressed': state.view === 'client',
        onclick: () => { state.view = 'client'; render(); },
      }, 'Client-facing'),
      tip('Internal shows what GMS pays the media owner. Client-facing shows the amount billed after applying the booked line margin.', 'Audience view')),

    statusChip,
    exportMenu(),
    store.state.mode === 'supabase'
      ? el('button', {
        class: 'btn ghost',
        onclick: async () => { await store.signOut(); render(); },
      }, 'Sign out')
      : null,
    el('button', {
      class: 'btn ghost', 'aria-label': 'Toggle light or dark theme',
      onclick: () => {
        state.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = state.theme;
        localStorage.setItem('tracking-theme', state.theme);
      },
    }, '◐'));
}

/**
 * What the sync state actually means, and what to do about it.
 *
 * Every line here answers one question a colleague mid-entry has: is my work
 * safe, and do I stop?
 */
function syncDetail() {
  const st = store.state;
  const n = st.pending || 0;
  const queued = n
    ? `${n} change${n === 1 ? '' : 's'} waiting to send. They are kept on this `
      + 'computer and go up on their own once the connection is back.'
    : 'Nothing is waiting to send.';

  const copy = {
    synced: ['Everything is saved', 'Your entries are in the shared database. Colleagues see them.'],
    saving: ['Saving', 'A moment — your entries are on their way up.'],
    loading: ['Loading', 'Reading the shared database.'],
    local: ['This browser only', 'Not signed in to the shared database, so nothing you type here reaches '
      + 'anyone else. Take a backup from Settings ▸ Data before you rely on it.'],
    locked: ['Signed out', st.error || 'Enter the team password to reconnect.'],
    offline: ['Not reaching the database', `${queued} Keep working — nothing is lost.`],
  }[st.status] || ['Ready', ''];

  dialog({
    title: copy[0],
    sub: copy[1],
    content: st.status === 'offline' && st.error
      ? [el('p', { class: 'hint' }, 'What the server said: ' + st.error)]
      : [],
    actions: [
      { label: 'Download backup', onClick: () => { exportBackup(); return false; } },
      { label: 'Close', primary: true },
    ],
  });
}

function paintStatus() {
  if (!statusChip) return;
  const map = {
    local: ['This browser', ''],
    synced: ['Live · synced', ''],
    saving: ['Saving…', 'warn'],
    loading: ['Loading…', 'warn'],
    offline: ['Not syncing', 'crit'],
    locked: ['Signed out', 'crit'],
    ready: ['Ready', ''],
  };
  let [label, kind] = map[store.state.status] || ['Ready', ''];
  /* Queued work is visible work — a count, not a vague "changes queued".
     Nothing in the outbox is lost on refresh any more, and the chip says so. */
  const n = store.state.pending || 0;
  if (store.state.status === 'offline') {
    label = n
      ? `Not syncing · ${n} change${n === 1 ? '' : 's'} kept — click`
      : 'Not syncing — click to see why';
  } else if (n > 0) {
    label += ` · ${n} queued`;
  }
  statusChip.className = 'chip ' + kind;
  fill(statusChip, el('span', { class: 'dot' }), label);
  statusChip.setAttribute('aria-label', store.state.error || `${label}. Open sync detail.`);
}

function exportMenu() {
  const wrap = el('div', { style: { position: 'relative' } });
  const menu = el('div', {
    style: {
      position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 50,
      background: 'var(--surface)', border: '1px solid var(--line)',
      borderRadius: 'var(--radius-s)', boxShadow: 'var(--shadow-lg)',
      padding: '6px', display: 'none', minWidth: '250px',
    },
  },
  item('Export to Excel…', 'Choose internal or a per-client report', () => openExport(state)),
  el('div', { style: { height: '1px', background: 'var(--line)', margin: '5px 0' } }),
  item('Backup (.json)', 'Full data snapshot', exportBackup));

  function item(title, sub, fn) {
    return el('div', { class: 'export-menu-row' },
      el('button', {
        class: 'btn ghost',
        style: { width: '100%', textAlign: 'left', padding: '8px 10px' },
        onclick: () => {
          menu.style.display = 'none';
          Promise.resolve(fn()).catch((e) => toast(e.message || String(e), 'bad'));
        },
      }, el('div', { style: { fontWeight: 600 } }, title)),
      tip(sub, title));
  }

  const btn = el('button', {
    class: 'btn', onclick: (e) => {
      e.stopPropagation();
      menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    },
  }, 'Export ▾');
  document.addEventListener('click', () => { menu.style.display = 'none'; });
  wrap.append(btn, menu);
  return wrap;
}

function activeSection() {
  return NAV.find((section) => section.tabs.some(([tab]) => tab === state.tab)) || NAV[0];
}

function primaryNav() {
  const current = activeSection();
  return el('nav', { class: 'v2-primary-nav', 'aria-label': 'Main navigation' },
    ...NAV.map((section) => el('button', {
      'aria-current': current.id === section.id ? 'page' : null,
      onclick: () => section.id === 'plans' ? openPlan() : goTo(section.defaultTab),
    }, section.label)));
}

function secondaryNav() {
  const section = activeSection();
  if (section.tabs.length === 1) return el('div', { class: 'v2-nav-gap' });
  const showMonth = state.tab === 'tracking';
  return el('nav', { class: 'tabbar v2-secondary-nav', 'aria-label': `${section.label} views` },
    ...section.tabs.map(([id, label]) => el('button', {
      'aria-selected': state.tab === id,
      onclick: () => id === 'clients' ? openPlan() : goTo(id),
    }, label)),
    showMonth ? monthNav() : null);
}

function platformLauncher() {
  const groups = new Map();
  store.all('line').forEach((line) => {
    const platform = String(line.platform || '').trim();
    if (!platform) return;
    if (!groups.has(platform)) groups.set(platform, []);
    groups.get(platform).push(line);
  });
  const platforms = [...groups].sort(([a], [b]) => a.localeCompare(b));
  const selected = state.filters.platform;

  return el('section', { class: 'platform-launcher' + (selected ? ' selected' : '') },
    el('div', { class: 'platform-launcher-head' },
      el('div', {},
        el('span', { class: 'eyebrow' }, 'Platform update session'),
        el('h2', {}, 'Update cumulative spend',
          tip('Open one advertising account, then update every client and campaign visible under that platform.')))),
    el('div', { class: 'platform-account-grid' },
      ...platforms.map(([platform, lines]) => {
        const campaignIds = new Set(lines.map((line) => line.campaign_id));
        const clientIds = new Set([...campaignIds].map((id) => store.byId('campaign', id)?.client_id).filter(Boolean));
        const lineIds = new Set(lines.map((line) => line.id));
        const latest = store.all('spend')
          .filter((row) => lineIds.has(row.line_id) && row.date)
          .map((row) => row.date).sort().at(-1);
        const color = PLATFORM_COLOR[platform] || 'var(--v2-blue)';
        return el('button', {
          class: 'platform-account-card' + (selected === platform ? ' active' : ''),
          'aria-pressed': selected === platform,
          style: { '--platform-color': color },
          onclick: () => {
            state.filters = { ...emptyFilters(), platform };
            render();
          },
        },
        el('span', { class: 'platform-account-mark', 'aria-hidden': 'true' }),
        el('span', {}, el('b', {}, platform),
          el('small', {}, `${lines.length} line${lines.length === 1 ? '' : 's'}, ${clientIds.size} client${clientIds.size === 1 ? '' : 's'} · ${latest ? dateAu(latest) : 'No update'}`)),
        el('span', { class: 'platform-account-arrow', 'aria-hidden': 'true' }, selected === platform ? '✓' : '›'));
      })));
}

/** Month stepper — kept up on the tab row, as on the UQ dashboard, so the
    big month band below stays a heading rather than a control cluster. */
function monthNav() {
  const step = (dir) => {
    const months = monthsAvailable();
    if (!state.ym) { state.ym = months.at(dir > 0 ? -1 : 0) || ymOf(todayIso()); render(); return; }
    const [y, m] = state.ym.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    state.ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    render();
  };
  const short = state.ym
    ? new Date(Number(state.ym.slice(0, 4)), Number(state.ym.slice(5, 7)) - 1, 1)
      .toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })
    : 'All months';

  return el('div', { class: 'monthnav' },
    el('button', { onclick: () => step(-1), 'aria-label': 'Previous month' }, '‹'),
    el('span', { class: 'mlabel' }, short),
    el('button', { onclick: () => step(1), 'aria-label': 'Next month' }, '›'),
    el('button', {
      class: 'all',
      'aria-label': state.ym ? 'Show every month at once' : 'Back to a single month',
      onclick: () => { state.ym = state.ym ? '' : ymOf(todayIso()); render(); },
    }, state.ym ? 'All' : 'Month'));
}

function confidBand() {
  const bands = [];
  /* The warning belongs to the internal figures. On the client-facing view
     there is nothing sensitive on screen, so the toggle carries the state on
     its own and the band would just be noise. */
  if (APP.confidential && state.view === 'internal') {
    bands.push(el('div', { class: 'confid' },
      el('strong', {}, 'INTERNAL'),
      tip('This page shows margin and internal media cost. Do not share the link or a screenshot with a client. Use Export ▸ Client report instead.', 'Internal data notice')));
  }

  if (staleNotice) {
    bands.push(el('div', { class: 'viewband' },
      el('strong', {}, 'FILTER RESET'),
      el('span', {}, staleNotice)));
  }

  /* Say it plainly — nobody should ever mistake the sample spend for actuals. */
  if (store.isDemo()) {
    bands.push(el('div', { class: 'confid demo' },
      el('strong', {}, 'SAMPLE DATA'),
      tip('Anonymised sample built from three real media plans. Client names, IO numbers and every margin have been replaced, and spend is invented. Structure and arithmetic are genuine; the numbers are not. Clear it before entering anything real.', 'Sample data notice'),
      el('button', {
        class: 'btn sm', style: { marginLeft: 'auto' },
        onclick: () => goTo('admin'),
      }, 'Clear it')));
  }
  return bands.length ? el('div', {}, ...bands) : el('div');
}

/* ---------------------------------------------------------------- period */

function period() {
  const months = monthsAvailable();
  const label = state.ym
    ? [monthLabel(state.ym).split(' ')[0], el('span', {}, state.ym.slice(0, 4))]
    : ['ALL MONTHS'];

  return el('div', { class: 'period' },
    el('h2', {}, ...label),
    el('div', { class: 'meta' },
      `${rows.length} line${rows.length === 1 ? '' : 's'} in view`,
      months.length ? ` · plan covers ${monthLabel(months[0])} – ${monthLabel(months.at(-1))}` : ''));
}

/* --------------------------------------------------------------- filters */

function filterBar() {
  const f = facets();
  const sel = (key, label, options, toValue = (o) => o, toLabel = (o) => o) =>
    el('div', { style: { display: 'flex', alignItems: 'center' } },
      el('label', {}, label),
      el('select', {
        onchange: (e) => { state.filters[key] = e.target.value; render(); },
      },
      el('option', { value: '' }, 'All'),
      ...options.map((o) => el('option', {
        value: toValue(o), selected: toValue(o) === state.filters[key],
      }, toLabel(o)))));

  const search = el('input', {
    type: 'search', placeholder: 'Search campaign, placement, market…',
    value: state.filters.q, autocomplete: 'off',
    oninput: (e) => { state.filters.q = e.target.value; debounced(); },
  });

  let timer;
  const debounced = () => { clearTimeout(timer); timer = setTimeout(render, 220); };

  const active = Object.values(state.filters).some(Boolean);

  return el('div', { class: 'filters' },
    sel('client', 'Client', f.clients, (c) => c.id, (c) => c.name),
    sel('platform', 'Platform', f.platforms),
    sel('objective', 'Objective', f.objectives),
    sel('campaign', 'Campaign', f.campaigns, (c) => c.id, (c) => c.name),
    sel('status', 'Status', f.statuses),
    el('div', { class: 'grow' }, search,
      active ? el('button', {
        class: 'btn ghost sm', style: { flex: 'none' },
        onclick: () => { state.filters = emptyFilters(); render(); },
      }, 'Clear') : null));
}

/* ---------------------------------------------------------------- footer */

function footer() {
  return el('div', { class: 'foot' },
    el('img', { src: 'assets/kmt-logo.png', alt: 'Kaleidoscope Management Technology' }),
    el('div', { class: 'fline' }, 'design & delivery by ',
      el('a', { href: 'https://kmt.global', target: '_blank', rel: 'noopener' },
        'Kaleidoscope Management Technology')),
    el('div', { class: 'fsub' }, 'See Infinitely.'));
}

export { render, state };
