/* App shell — chrome, routing, filters, and the one re-render everything calls. */

import { APP, SUPABASE } from './config.js';
import { el, fill, clear, monthLabel, toast } from './dom.js';
import * as store from './store.js';
import { buildRows, facets, monthsAvailable, emptyFilters } from './model.js';
import { renderTracking } from './view-tracking.js';
import { renderSpend } from './view-spend.js';
import { renderImport } from './view-import.js';
import { renderAdmin } from './view-admin.js';
import { exportBackup } from './exportxlsx.js';
import { openExport, closeExport } from './view-export.js';
import { ymOf, todayIso } from './calc.js';
import { closeDrawer } from './drawer.js';

const TABS = [
  ['tracking', 'Tracking'],
  ['spend', 'Spend entry'],
  ['import', 'Import plan'],
  ['admin', 'Admin'],
];

const state = {
  tab: 'tracking',
  view: 'internal',
  ym: ymOf(todayIso()),
  filters: emptyFilters(),
  spendMode: 'month',
  spendDate: '',
  theme: localStorage.getItem('tracking-theme') || '',
};

const root = document.getElementById('root');

/* ------------------------------------------------------------------ boot */

(async function boot() {
  if (state.theme) document.documentElement.dataset.theme = state.theme;
  readUrl();
  await store.init();
  store.onChange(() => { paintStatus(); });
  render();
}());

/* -------------------------------------------------------------- url state */

function readUrl() {
  const p = new URLSearchParams(location.hash.slice(1));
  if (p.get('tab')) state.tab = p.get('tab');
  if (p.get('view')) state.view = p.get('view');
  if (p.has('ym')) state.ym = p.get('ym');
  for (const k of Object.keys(state.filters)) if (p.get(k)) state.filters[k] = p.get(k);
}

function writeUrl() {
  const p = new URLSearchParams();
  p.set('tab', state.tab);
  p.set('view', state.view);
  p.set('ym', state.ym || '');
  for (const [k, v] of Object.entries(state.filters)) if (v) p.set(k, v);
  history.replaceState(null, '', '#' + p.toString());
}

/* ---------------------------------------------------------------- render */

let rows = [];

function render() {
  writeUrl();

  if (store.state.status === 'locked') { renderGate(); return; }

  rows = buildRows(state);

  /* fill() returns the container it filled, not the child — appending to its
     return value put the whole page outside .app, which is why the gutter and
     the max-width never appeared. */
  const app = el('div', { class: 'app' });
  fill(root, app);
  app.appendChild(topbar());
  app.appendChild(tabbar());
  app.appendChild(confidBand());

  if (state.tab !== 'admin' && state.tab !== 'import') {
    app.appendChild(period());
    app.appendChild(filterBar());
  }

  const view = el('div');
  app.appendChild(view);
  const ctx = { rows, state, rerender: render, goTo };
  if (state.tab === 'tracking') renderTracking(view, ctx);
  else if (state.tab === 'spend') renderSpend(view, ctx);
  else if (state.tab === 'import') renderImport(view, ctx);
  else renderAdmin(view, ctx);

  app.appendChild(footer());
}

function goTo(tab) { state.tab = tab; closeDrawer(); closeExport(); render(); }

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
    el('div', { class: 'hint', style: { marginTop: '14px' } },
      'If you need access, ask Coco.'))));
  setTimeout(() => pw.focus(), 30);
}

/* ---------------------------------------------------------------- chrome */

let statusChip = null;

function topbar() {
  statusChip = el('span', { class: 'chip' }, el('span', { class: 'dot' }), 'ready');
  paintStatus();

  return el('div', { class: 'topbar' },
    el('div', { class: 'plate' },
      el('img', { src: 'assets/gms-logo.png', alt: 'GMS' }),
      el('span', { class: 'rule' }),
      el('span', { class: 'mark' }, 'DIGITAL')),
    el('div', { class: 'titles' },
      el('h1', {}, APP.title),
      el('p', {}, APP.sub)),
    el('div', { class: 'spacer' }),

    el('div', { class: 'seg', role: 'group', 'aria-label': 'Figure view' },
      el('button', {
        'aria-pressed': state.view === 'internal',
        title: 'Budgets and spend as paid to the media owner',
        onclick: () => { state.view = 'internal'; render(); },
      }, 'Internal'),
      el('button', {
        class: 'client', 'aria-pressed': state.view === 'client',
        title: 'What the client is billed — internal spend grossed up at the plan margin',
        onclick: () => { state.view = 'client'; render(); },
      }, 'Client-facing')),

    statusChip,
    exportMenu(),
    store.state.mode === 'supabase'
      ? el('button', {
        class: 'btn ghost', title: 'Sign out',
        onclick: async () => { await store.signOut(); render(); },
      }, 'Sign out')
      : null,
    el('button', {
      class: 'btn ghost', title: 'Light / dark',
      onclick: () => {
        state.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = state.theme;
        localStorage.setItem('tracking-theme', state.theme);
      },
    }, '◐'));
}

function paintStatus() {
  if (!statusChip) return;
  const map = {
    local: ['This browser', ''],
    synced: ['Live · synced', ''],
    saving: ['Saving…', 'warn'],
    loading: ['Loading…', 'warn'],
    offline: ['Offline — changes queued', 'crit'],
    locked: ['Signed out', 'crit'],
    ready: ['Ready', ''],
  };
  const [label, kind] = map[store.state.status] || ['Ready', ''];
  statusChip.className = 'chip ' + kind;
  fill(statusChip, el('span', { class: 'dot' }), label);
  statusChip.title = store.state.mode === 'local'
    ? 'Data lives in this browser only. Take a backup from Admin.'
    : (store.state.error || 'Supabase');
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
    return el('button', {
      class: 'btn ghost',
      style: { display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px' },
      onclick: () => {
        menu.style.display = 'none';
        Promise.resolve(fn()).catch((e) => toast(e.message || String(e), 'bad'));
      },
    }, el('div', { style: { fontWeight: 600 } }, title),
    el('div', { class: 'muted', style: { fontSize: '11.5px' } }, sub));
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

function tabbar() {
  const showNav = state.tab !== 'admin' && state.tab !== 'import';
  return el('nav', { class: 'tabbar' },
    ...TABS.map(([id, label]) =>
      el('button', {
        'aria-selected': state.tab === id,
        onclick: () => goTo(id),
      }, label)),
    showNav ? monthNav() : null);
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
    el('button', { onclick: () => step(-1), title: 'Previous month', 'aria-label': 'Previous month' }, '‹'),
    el('span', { class: 'mlabel' }, short),
    el('button', { onclick: () => step(1), title: 'Next month', 'aria-label': 'Next month' }, '›'),
    el('button', {
      class: 'all',
      title: state.ym ? 'Show every month at once' : 'Back to a single month',
      onclick: () => { state.ym = state.ym ? '' : ymOf(todayIso()); render(); },
    }, state.ym ? 'All' : 'Month'));
}

function confidBand() {
  const bands = [];
  if (APP.confidential) {
    bands.push(el('div', { class: 'confid' },
      el('strong', {}, 'INTERNAL'),
      el('span', {}, 'This page shows margin and internal media cost. Do not share the link or a screenshot with a client — use Export ▸ Client report instead.')));
  }
  /* Say it plainly — nobody should ever mistake the sample spend for actuals. */
  if (store.isDemo()) {
    bands.push(el('div', { class: 'confid demo' },
      el('strong', {}, 'SAMPLE DATA'),
      el('span', {}, 'Anonymised sample built from three real media plans — client names, IO numbers and every margin have been replaced, and spend is invented. Structure and arithmetic are genuine; the numbers are not. Clear it before entering anything real.'),
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
    el('div', { class: 'grow', style: { display: 'flex' } }, search),
    active ? el('button', {
      class: 'btn ghost sm',
      onclick: () => { state.filters = emptyFilters(); render(); },
    }, 'Clear') : null);
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
