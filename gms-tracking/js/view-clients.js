/* Clients — a media plan in the shape it arrived in.
 *
 * Plans are imported one client at a time, so this is the view that matches
 * the source: client → campaign → line, collapsible, across every month the
 * plan covers rather than the single month selected above. Slicing a plan by
 * calendar month is what makes it hard to recognise.
 */

import { el, money, pct, monthLabel, dateAu, tag } from './dom.js';
import { PLATFORM_COLOR } from './config.js';
import { all, where, fxMap } from './store.js';
import { lineMetrics, totals, todayIso, num } from './calc.js';
import { openLine } from './drawer.js';
import { resizable } from './resizable.js';

/* Collapse state lives across re-renders, keyed by id. */
const open = { campaigns: new Set(), clients: new Set() };
let booted = false;

export function renderClients(host, ctx) {
  const { state, rerender } = ctx;
  const f = state.filters || {};
  const fx = fxMap();
  const today = todayIso();

  const clients = all('client')
    .filter((c) => !f.client || c.id === f.client)
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  if (!clients.length) {
    host.appendChild(el('div', { class: 'panel' }, el('div', { class: 'empty' },
      el('strong', {}, 'No clients yet'),
      el('div', {}, 'Import a media plan and the client appears here.'))));
    return;
  }

  /* First visit: every client open, campaigns open, lines collapsed. */
  if (!booted) {
    booted = true;
    clients.forEach((c) => open.clients.add(c.id));
    all('campaign').forEach((k) => open.campaigns.add(k.id));
  }

  host.appendChild(el('div', { class: 'panel' },
    el('header', {},
      el('div', {},
        el('h3', {}, 'Plans by client'),
        /* This page has no month stepper — it always shows the full flight, so
           the copy must not point at a control that is not there. */
        el('p', {}, 'Each plan in the shape it arrived in, across every month it covers. Click a campaign to show its lines.')),
      el('div', { style: { flex: 1 } }),
      el('button', {
        class: 'btn sm',
        onclick: () => {
          const anyOpen = open.campaigns.size > 0;
          open.campaigns.clear();
          if (!anyOpen) all('campaign').forEach((k) => open.campaigns.add(k.id));
          rerender();
        },
      }, open.campaigns.size ? 'Collapse all' : 'Expand all')),
    el('div', { class: 'body plans' },
      ...clients.map((c) => clientBlock(c, { f, fx, today, state, rerender })))));
}

/* --------------------------------------------------------------- client */

function clientBlock(client, ctx) {
  const { f, rerender } = ctx;
  const campaigns = where('campaign', (k) => k.client_id === client.id)
    .filter((k) => !f.campaign || k.id === f.campaign)
    .sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''));

  const built = campaigns.map((k) => buildCampaign(k, ctx));
  const shown = built.filter((b) => b.rows.length);
  if (!shown.length) return el('div');

  const side = ctx.state.view;
  const t = totals(shown.flatMap((b) => b.rows));
  const isOpen = open.clients.has(client.id);

  return el('div', { class: 'planclient' },
    el('button', {
      class: 'planrow client' + (isOpen ? ' open' : ''),
      onclick: () => { isOpen ? open.clients.delete(client.id) : open.clients.add(client.id); rerender(); },
    },
    el('span', { class: 'chev' }, isOpen ? '▾' : '▸'),
    el('b', {}, client.name),
    el('span', { class: 'muted' },
      `${shown.length} campaign${shown.length > 1 ? 's' : ''} · ${t.count} line${t.count > 1 ? 's' : ''}`),
    el('span', { class: 'planfig' },
      el('b', {}, money(t[side].spend)),
      el('span', { class: 'muted' }, ` of ${money(t[side].budget)}`)),
    progress(t[side].spend, t[side].budget)),

    isOpen ? el('div', { class: 'plankids' }, ...shown.map((b) => campaignBlock(b, ctx))) : null);
}

/* ------------------------------------------------------------- campaign */

function buildCampaign(campaign, { fx, today, state }) {
  const f = state.filters || {};
  const monthsBy = new Map();
  for (const m of all('line_month')) {
    if (!monthsBy.has(m.line_id)) monthsBy.set(m.line_id, []);
    monthsBy.get(m.line_id).push(m);
  }
  const spendBy = new Map();
  for (const s of all('spend')) {
    if (!spendBy.has(s.line_id)) spendBy.set(s.line_id, []);
    spendBy.get(s.line_id).push(s);
  }

  const rows = where('line', (l) => l.campaign_id === campaign.id)
    .filter((l) => (!f.platform || l.platform === f.platform)
      && (!f.objective || l.objective === f.objective)
      && (!f.status || (l.status || 'Not started') === f.status)
      && (!f.q || [l.platform, l.objective, l.placement, l.supplier, l.market, campaign.name]
        .join(' ').toLowerCase().includes(f.q.trim().toLowerCase())))
    .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
    /* ym: null → the whole plan, not one month. That is the point of this view. */
    .map((l) => {
      const m = lineMetrics(l, campaign, monthsBy.get(l.id) || [], spendBy.get(l.id) || [],
        { fx, ym: null, today });
      m.campaignName = campaign.name || '—';
      return m;
    });

  return { campaign, rows };
}

function campaignBlock({ campaign, rows }, ctx) {
  const { rerender, state } = ctx;
  const side = state.view;
  const t = totals(rows);
  const isOpen = open.campaigns.has(campaign.id);

  return el('div', { class: 'plancampaign' },
    el('button', {
      class: 'planrow campaign' + (isOpen ? ' open' : ''),
      onclick: () => {
        isOpen ? open.campaigns.delete(campaign.id) : open.campaigns.add(campaign.id);
        rerender();
      },
    },
    el('span', { class: 'chev' }, isOpen ? '▾' : '▸'),
    el('span', {},
      el('b', {}, campaign.name || 'Untitled campaign'),
      campaign.io_number ? el('span', { class: 'muted', style: { marginLeft: '8px', fontSize: '11px' } }, campaign.io_number) : null,
      el('div', { class: 'muted', style: { fontSize: '11px' } },
        campaign.start_date ? `${dateAu(campaign.start_date)} – ${dateAu(campaign.end_date)}` : 'no flight dates',
        ` · ${rows.length} line${rows.length > 1 ? 's' : ''}`,
        campaign.fx_rate ? ` · 1 AUD = ${campaign.fx_rate} ${campaign.fx_ccy || ''}` : '')),
    el('span', { class: 'planfig' },
      el('b', {}, money(t[side].spend)),
      el('span', { class: 'muted' }, ` of ${money(t[side].budget)}`)),
    progress(t[side].spend, t[side].budget)),

    isOpen ? lineTable(rows, ctx) : null);
}

/* ----------------------------------------------------------------- lines */

function lineTable(rows, { state, rerender }) {
  const side = state.view;
  const months = [...new Set(rows.flatMap((m) =>
    where('line_month', (x) => x.line_id === m.line.id).map((x) => x.ym)))].sort();

  return el('div', { class: 'tablewrap' }, resizable(el('table', { class: 'data' },
    el('thead', {}, el('tr', {},
      el('th', {}, 'Platform'), el('th', {}, 'Objective'), el('th', {}, 'Line'),
      el('th', {}, 'Buy'),
      el('th', { class: 'num' }, 'Booked rate'),
      el('th', { class: 'num' }, 'Budget'),
      el('th', { class: 'num' }, 'Spend'),
      el('th', {}, 'Pacing'),
      el('th', { class: 'num' }, 'Margin'),
      ...months.map((ym) => el('th', { class: 'num mo', title: monthLabel(ym) }, monthLabel(ym).slice(0, 3))),
      el('th', {}, 'Status'))),
    el('tbody', {}, ...rows.map((m) => lineRow(m, months, side, rerender))),
    footRow(rows, months, side)),
  `by-client-${months.length}`,
  [110, 115, 250, 80, 105, 105, 105, 130, 85, ...months.map(() => 90), 105]));
}

function lineRow(m, months, side, rerender) {
  const s = m[side];
  const byMonth = new Map(where('line_month', (x) => x.line_id === m.line.id)
    .map((x) => [x.ym, side === 'internal' ? num(x.budget_media) : num(x.budget_gms)]));

  return el('tr', {
    class: m.billable ? '' : 'nb', style: { cursor: 'pointer' },
    onclick: () => openLine(m, rerender),
  },
  el('td', {}, m.line.platform
    ? el('span', { class: 'tag', style: { color: PLATFORM_COLOR[m.line.platform] || 'var(--ink-2)' } },
      el('span', { class: 'pd' }), m.line.platform)
    : el('span', { class: 'muted' }, '—')),
  el('td', {}, m.line.objective || el('span', { class: 'muted' }, '—')),
  el('td', { class: 'wrap' }, m.line.placement || m.line.supplier || '—',
    m.line.market ? el('div', { class: 'muted', style: { fontSize: '11px' } }, m.line.market) : null),
  el('td', {}, m.line.buy_method || '—'),
  el('td', { class: 'num' }, s.bookedRate == null ? '—' : money(s.bookedRate, 'AUD', 2)),
  el('td', { class: 'num' }, money(s.budget)),
  el('td', { class: 'num' }, money(s.spend)),
  el('td', {}, el('div', { style: { display: 'flex', alignItems: 'center', gap: '7px' } },
    meterBar(s.pacingPct, m.timePct, s.flag),
    el('span', { class: 'muted', style: { fontSize: '11px' } }, pct(s.pacingPct, 0)))),
  el('td', { class: 'num' }, m.billable
    ? el('span', { class: 'tag' + (m.margin > 0 ? '' : ' crit') },
      m.margin > 0 ? pct(m.margin, 1) : 'not set')
    : el('span', { class: 'muted' }, 'n/a')),
  ...months.map((ym) => {
    const v = byMonth.get(ym);
    return el('td', { class: 'num mo' + (v ? '' : ' muted') }, v ? money(v) : '·');
  }),
  el('td', {}, el('span', { class: 'tag' }, m.line.status || 'Not started')));
}

function footRow(rows, months, side) {
  const t = totals(rows);
  const monthTotal = (ym) => rows.reduce((a, m) => a + where('line_month',
    (x) => x.line_id === m.line.id && x.ym === ym)
    .reduce((b, x) => b + (side === 'internal' ? num(x.budget_media) : num(x.budget_gms)), 0), 0);

  return el('tfoot', {}, el('tr', {},
    el('td', { colspan: 5 }, `Total · ${rows.length} line${rows.length > 1 ? 's' : ''}`),
    el('td', { class: 'num' }, money(t[side].budget)),
    el('td', { class: 'num' }, money(t[side].spend)),
    el('td', {}, pct(t[side].pacingPct, 0)),
    el('td', { class: 'num' }, side === 'client' ? pct(t.effMargin, 1) : '—'),
    ...months.map((ym) => el('td', { class: 'num mo' }, money(monthTotal(ym)))),
    el('td', {})));
}

/* --------------------------------------------------------------- pieces */

function progress(spend, budget) {
  const p = budget > 0 ? spend / budget : 0;
  return el('span', { class: 'planbar', title: budget > 0 ? `${pct(p, 0)} of budget` : 'no budget booked' },
    el('i', {
      style: {
        width: Math.min(100, p * 100) + '%',
        background: p > 1.02 ? 'var(--crit)' : 'var(--orange)',
      },
    }));
}

function meterBar(pacingPct, timePct, flag) {
  const w = Math.min(100, Math.max(0, (pacingPct || 0) * 100));
  const t = timePct == null ? null : Math.min(100, Math.max(0, timePct * 100));
  return el('div', {
    class: 'meter',
    title: `Spend ${pct(pacingPct, 1)} of budget · time elapsed ${t == null ? '—' : pct(timePct, 1)}`,
  },
  el('i', { class: flag, style: { width: w + '%' } }),
  t == null ? null : el('u', { style: { left: t + '%' } }));
}

export { tag };
