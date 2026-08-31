/* Plans use a deliberate drill-down: client cards, campaign cards, then the
 * full campaign. The hierarchy changes without removing any line-level data
 * or controls from the existing application. */

import { el, money, pct, monthLabel, dateAu, tag, tip } from './dom.js';
import { PLATFORM_COLOR } from './config.js';
import { all, where, byId, fxMap } from './store.js';
import { lineMetrics, totals, todayIso, num, effectiveStatus } from './calc.js';
import { openLine } from './drawer.js';
import { resizable } from './resizable.js';
import { entityNotes, entityNoteCount, openEntityNotes } from './notes.js';

export function renderClients(host, ctx) {
  const fx = fxMap();
  const today = todayIso();
  const clients = all('client').sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  if (!clients.length) {
    host.appendChild(el('div', { class: 'plan-empty-v2' }, el('div', { class: 'empty' },
      el('strong', {}, 'No clients yet'),
      el('div', {}, 'Import a media plan and the client appears here.'))));
    return;
  }

  const client = ctx.state.planClient ? byId('client', ctx.state.planClient) : null;
  const campaign = ctx.state.planCampaign ? byId('campaign', ctx.state.planCampaign) : null;
  const routeCtx = { ...ctx, fx, today };

  if (campaign && client && campaign.client_id === client.id) {
    renderCampaignView(host, client, campaign, routeCtx);
    return;
  }
  if (client) {
    if (ctx.state.planCampaign) ctx.state.planCampaign = '';
    renderClientView(host, client, routeCtx);
    return;
  }
  if (ctx.state.planClient || ctx.state.planCampaign) {
    ctx.state.planClient = '';
    ctx.state.planCampaign = '';
  }
  renderClientGrid(host, clients, routeCtx);
}

function pageHead(eyebrow, title, description, actions = []) {
  return el('header', { class: 'plans-page-head-v2' },
    el('div', {},
      el('span', { class: 'eyebrow' }, eyebrow),
      el('h2', {}, title),
      description ? el('p', {}, description) : null),
    actions.length ? el('div', { class: 'plans-page-actions-v2' }, ...actions) : null);
}

function breadcrumb(items) {
  return el('nav', { class: 'plans-breadcrumb-v2', 'aria-label': 'Plan breadcrumb' },
    ...items.flatMap((item, index) => [
      index ? el('span', { 'aria-hidden': 'true' }, '›') : null,
      item.onClick
        ? el('button', { onclick: item.onClick }, item.label)
        : el('span', { 'aria-current': 'page' }, item.label),
    ]).filter(Boolean));
}

function renderClientGrid(host, clients, ctx) {
  host.appendChild(pageHead('Plans', 'Clients',
    'Choose a client first, then open one campaign and its execution detail.', [
      el('button', { class: 'btn', onclick: () => ctx.goTo('tracking') }, 'Portfolio overview'),
      el('button', { class: 'btn primary', onclick: () => ctx.goTo('import') }, 'Import plan'),
    ]));

  host.appendChild(el('div', { class: 'plans-client-grid-v2' }, ...clients.map((client) => {
    const campaigns = campaignsFor(client);
    const built = campaigns.map((campaign) => buildCampaign(campaign, withoutFilters(ctx)));
    const rows = built.flatMap((item) => item.rows);
    const t = totals(rows);
    const side = ctx.state.view;
    const active = built.filter((item) => item.rows.some((m) =>
      ['Live', 'Paused'].includes(effectiveStatus(m.line, item.campaign, ctx.today)))).length;
    const latest = latestSpend(rows);
    return el('article', { class: 'plans-client-card-v2' },
      el('span', { class: 'plans-card-kicker-v2' },
        `${campaigns.length} campaign${campaigns.length === 1 ? '' : 's'} · ${rows.length} lines`),
      el('h3', {}, client.name || 'Untitled client'),
      el('div', { class: 'plans-card-meta-v2' },
        el('span', {}, `${active} active`),
        el('span', {}, latest ? `Latest ${dateAu(latest)}` : 'No spend update')),
      el('div', { class: 'plans-card-metrics-v2' },
        cardMetric(side === 'internal' ? 'Internal spend' : 'Client spend', money(t[side].spend)),
        cardMetric('Whole-flight delivery', pct(t[side].pacingPct, 0))),
      progress(t[side].spend, t[side].budget),
      el('button', {
        class: 'plans-card-link-v2',
        onclick: () => ctx.openPlan(client.id),
        'aria-label': `Open ${client.name || 'client'}`,
      }, 'Open client', el('span', { 'aria-hidden': 'true' }, '→')));
  })));
}

function renderClientView(host, client, ctx) {
  const campaigns = campaignsFor(client);
  const built = campaigns.map((campaign) => buildCampaign(campaign, withoutFilters(ctx)));
  const rows = built.flatMap((item) => item.rows);
  const t = totals(rows);
  const side = ctx.state.view;

  host.appendChild(breadcrumb([
    { label: 'Plans', onClick: () => ctx.openPlan() },
    { label: client.name || 'Client' },
  ]));
  host.appendChild(pageHead('Client view', client.name || 'Untitled client',
    'Campaigns stay separate so each plan has a clear working space.', [
      el('button', { class: 'btn', onclick: () => ctx.goTo('tracking') }, 'View overview'),
      el('button', { class: 'btn primary', onclick: () => ctx.goTo('import') }, 'Add campaign plan'),
    ]));
  host.appendChild(el('div', { class: 'plans-summary-grid-v2' },
    summaryMetric('Campaigns', String(campaigns.length),
      `${built.filter((item) => item.rows.some((m) => effectiveStatus(m.line, item.campaign, ctx.today) === 'Live')).length} live`),
    summaryMetric('Line items', String(rows.length),
      `${rows.filter((m) => where('creative', (c) => c.line_id === m.line.id).length).length} split by creative`),
    summaryMetric(side === 'internal' ? 'Internal spend' : 'Client spend',
      money(t[side].spend), `${money(t[side].budget)} budget`),
    summaryMetric('Whole-flight delivery', pct(t[side].pacingPct, 0),
      latestSpend(rows) ? `Latest ${dateAu(latestSpend(rows))}` : 'No spend update')));
  host.appendChild(pinnedNote('client', client, ctx.rerender));

  const list = el('div', { class: 'plans-campaign-list-v2' });
  if (!built.length) list.appendChild(el('div', { class: 'empty' }, el('strong', {}, 'No campaigns')));
  for (const { campaign, rows: campaignRows } of built) {
    const tCampaign = totals(campaignRows);
    const status = campaignStatus(campaign, campaignRows, ctx.today);
    list.appendChild(el('article', { class: 'plans-campaign-card-v2' },
      el('div', { class: 'plans-campaign-main-v2' },
        el('span', { class: 'plans-card-kicker-v2' }, campaign.io_number || 'No IO number'),
        el('h3', {}, campaign.name || 'Untitled campaign'),
        el('div', { class: 'plans-card-meta-v2' },
          el('span', {}, campaign.start_date
            ? `${dateAu(campaign.start_date)} to ${dateAu(campaign.end_date)}` : 'No flight dates'),
          el('span', {}, `${campaignRows.length} line${campaignRows.length === 1 ? '' : 's'}`))),
      compactMetric('Status', tag(status)),
      compactMetric(side === 'internal' ? 'Internal spend' : 'Client spend', money(tCampaign[side].spend)),
      el('div', { class: 'plans-compact-metric-v2 plans-delivery-v2' },
        el('span', {}, 'Delivery'),
        el('b', {}, pct(tCampaign[side].pacingPct, 0)),
        progress(tCampaign[side].spend, tCampaign[side].budget)),
      el('button', {
        class: 'btn sm',
        onclick: () => ctx.openPlan(client.id, campaign.id),
        'aria-label': `Open ${campaign.name || 'campaign'}`,
      }, 'Open campaign')));
  }
  host.appendChild(list);
}

function renderCampaignView(host, client, campaign, ctx) {
  const rows = buildCampaign(campaign, withoutFilters(ctx)).rows;
  const t = totals(rows);
  const side = ctx.state.view;
  const status = campaignStatus(campaign, rows, ctx.today);
  const creativeCount = rows.reduce((sum, m) =>
    sum + where('creative', (c) => c.line_id === m.line.id).length, 0);

  host.appendChild(breadcrumb([
    { label: 'Plans', onClick: () => ctx.openPlan() },
    { label: client.name || 'Client', onClick: () => ctx.openPlan(client.id) },
    { label: campaign.name || 'Campaign' },
  ]));
  host.appendChild(pageHead(campaign.io_number || 'Campaign', campaign.name || 'Untitled campaign',
    campaign.start_date ? `${dateAu(campaign.start_date)} to ${dateAu(campaign.end_date)}` : 'No flight dates', [
      el('button', {
        class: 'btn',
        onclick: () => {
          ctx.state.filters = {
            client: client.id, platform: '', objective: '', campaign: campaign.id, status: '', q: '',
          };
          ctx.goTo('tracking');
        },
      }, 'View overview'),
      el('button', {
        class: 'btn primary',
        onclick: () => {
          const firstPlatform = rows[0]?.line.platform || '';
          ctx.state.filters = {
            client: '', platform: firstPlatform, objective: '', campaign: '', status: '', q: '',
          };
          ctx.goTo('spend');
        },
      }, 'Update spend'),
    ]));
  host.appendChild(el('div', { class: 'plans-summary-grid-v2' },
    summaryMetric('Campaign status', status,
      `${rows.filter((m) => effectiveStatus(m.line, campaign, ctx.today) === 'Live').length} live lines`),
    summaryMetric(side === 'internal' ? 'Internal spend' : 'Client spend',
      money(t[side].spend), `${money(t[side].budget)} budget`),
    summaryMetric('Whole-flight delivery', pct(t[side].pacingPct, 0),
      latestSpend(rows) ? `Latest ${dateAu(latestSpend(rows))}` : 'No spend update'),
    summaryMetric('Creatives', String(creativeCount),
      `Across ${rows.filter((m) => where('creative', (c) => c.line_id === m.line.id).length).length} lines`)));
  host.appendChild(el('section', { class: 'campaign-commercial-v2' },
    el('div', { class: 'campaign-commercial-copy-v2' },
      el('span', { class: 'eyebrow' }, 'Campaign economics'),
      el('h3', {}, 'Booked budget composition',
        tip('External budget is the client budget. Booked margin is external budget minus internal media budget.'))),
    campaignEconomics(campaign, ctx)));
  host.appendChild(el('section', { class: 'campaign-lines-v2 panel' },
    el('header', {}, el('div', {},
      el('h3', {}, 'Line items'),
      el('p', { class: 'muted' }, 'Open a line to edit its plan, status, creatives and tracking log.'))),
    lineTable(rows, ctx)));
}

function campaignsFor(client) {
  return where('campaign', (campaign) => campaign.client_id === client.id)
    .sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''));
}

function withoutFilters(ctx) {
  return { ...ctx, state: { ...ctx.state, filters: {} } };
}

function latestSpend(rows) {
  return rows.flatMap((m) => where('spend', (s) => s.line_id === m.line.id).map((s) => s.date))
    .filter(Boolean).sort().at(-1) || '';
}

function campaignStatus(campaign, rows, today) {
  const statuses = rows.map((m) => effectiveStatus(m.line, campaign, today));
  if (statuses.includes('Live')) return 'Live';
  if (statuses.includes('Paused')) return 'Paused';
  if (statuses.includes('Upcoming')) return 'Upcoming';
  if (statuses.includes('Stopped')) return 'Stopped';
  return statuses[0] || 'Completed';
}

function cardMetric(label, value) {
  return el('div', {}, el('span', {}, label), el('b', {}, value));
}

function compactMetric(label, value) {
  return el('div', { class: 'plans-compact-metric-v2' },
    el('span', {}, label), el('b', {}, value));
}

function summaryMetric(label, value, sub) {
  return el('div', {}, el('span', {}, label), el('b', {}, value),
    sub ? el('small', {}, sub) : null);
}

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
      && (!f.status || effectiveStatus(l, campaign, today) === f.status)
      && (!f.q || [l.platform, l.objective, l.placement, l.supplier, l.market, campaign.name]
        .join(' ').toLowerCase().includes(f.q.trim().toLowerCase())))
    .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
    .map((l) => {
      const m = lineMetrics(l, campaign, monthsBy.get(l.id) || [], spendBy.get(l.id) || [],
        { fx, ym: null, today });
      m.clientName = byId('client', campaign.client_id)?.name || '—';
      m.campaignName = campaign.name || '—';
      return m;
    });

  return { campaign, rows };
}

function campaignEconomics(campaign, ctx) {
  const fullRows = buildCampaign(campaign, {
    fx: ctx.fx,
    today: ctx.today,
    state: { ...ctx.state, filters: {} },
  }).rows;
  const t = totals(fullRows);
  const bookedMargin = t.client.budget - t.internal.budget;
  const marginPct = t.client.budget > 0 ? bookedMargin / t.client.budget : null;
  return el('div', { class: 'campaign-context-v2' },
    el('div', { class: 'campaign-economics-v2' },
      economy('External budget', t.client.budget),
      economy('Internal budget', t.internal.budget),
      economy('Booked margin', bookedMargin, marginPct)),
    pinnedNote('campaign', campaign, ctx.rerender),
    el('button', {
      class: 'btn sm primary',
      onclick: () => {
        ctx.state.filters = {
          client: campaign.client_id, platform: '', objective: '', campaign: campaign.id, status: '', q: '',
        };
        ctx.goTo('monthly');
      },
    }, 'Monthly pacing'));
}

function economy(label, value, percentage) {
  return el('div', {},
    el('span', {}, label),
    el('b', {}, money(value)),
    percentage == null ? null : el('small', {}, pct(percentage, 1)));
}

function pinnedNote(table, row, rerender) {
  const label = table === 'client' ? 'Client notes' : 'Campaign notes';
  const notes = entityNotes(table, row);
  const latest = notes[0];
  const count = entityNoteCount(table, row);
  return el('div', { class: 'pinned-note-v2' },
    el('button', {
      class: 'note-trigger-v2',
      title: count ? `Open ${label.toLowerCase()}` : `Add a ${label.toLowerCase().replace(/s$/, '')}`,
      'aria-label': `${label}, ${count} ${count === 1 ? 'entry' : 'entries'}`,
      onclick: () => openEntityNotes({ table, row, rerender }),
    },
    el('span', {}, label),
    el('small', {}, count || '+')));
}

function lineTable(rows, { state, rerender }) {
  const side = state.view;
  const months = [...new Set(rows.flatMap((m) =>
    where('line_month', (x) => x.line_id === m.line.id).map((x) => x.ym)))].sort();

  return el('div', { class: 'tablewrap' }, resizable(el('table', { class: 'data fill-panel' },
    el('thead', {}, el('tr', {},
      el('th', {}, 'Platform'), el('th', {}, 'Objective'), el('th', {}, 'Line'),
      el('th', {}, 'Buy'),
      el('th', { class: 'num' }, 'Booked rate'),
      el('th', { class: 'num' }, 'Budget'),
      el('th', { class: 'num' }, 'Spend'),
      el('th', {}, 'Pacing'),
      el('th', { class: 'num' }, 'Margin'),
      ...months.map((ym) => el('th', { class: 'num mo', 'aria-label': monthLabel(ym) }, monthLabel(ym).slice(0, 3))),
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
    'data-line-id': m.line.id,
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
  el('td', {}, el('span', { class: 'tag' }, effectiveStatus(m.line, m.campaign))));
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

function progress(spend, budget) {
  const p = budget > 0 ? spend / budget : 0;
  return el('span', { class: 'planbar', 'aria-label': budget > 0 ? `${pct(p, 0)} of budget` : 'no budget booked' },
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
  return el('div', { class: 'meter',
    'aria-label': `Spend ${pct(pacingPct, 1)} of budget · time elapsed ${t == null ? '—' : pct(timePct, 1)}` },
  el('i', { class: flag, style: { width: w + '%' } }),
  t == null ? null : el('u', { style: { left: t + '%' } }));
}

export { tag };
