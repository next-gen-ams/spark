/* Tracking — the read-at-a-glance page.
 *
 * Three questions, in the order you actually ask them:
 *   are we spending to plan?      → budget vs spend by month
 *   what needs attention today?   → the lines that are off pace
 *   where is the money going?     → platform split
 *
 * The line-by-line detail lives on Clients, where a media plan keeps its
 * original shape. */

import { el, money, pct, monthLabel } from './dom.js';
import { CARD_PLATFORMS, PLATFORM_COLOR } from './config.js';
import { totals, byPlatform } from './calc.js';
import { monthlySeries, campaignPace } from './model.js';
import { monthlyBars, platformSplit, pacingAlerts, campaignPacing } from './charts.js';
import { openLine } from './drawer.js';

export function renderTracking(host, ctx) {
  const { rows, state, rerender } = ctx;
  const side = state.view;

  host.appendChild(summaryCards(rows, state));

  if (!rows.length) {
    /* Say why it is empty, not just that it is. "Import a media plan" on top
       of a live dataset — because a search matched nothing — reads as though
       the data is gone. */
    const filtered = Object.values(state.filters).some(Boolean);
    const why = filtered
      ? 'Nothing matches these filters. Clear them, or widen the search.'
      : state.ym
        ? `No media-plan lines or spend fall inside ${monthLabel(state.ym)}. Try “All”, or clear the filters.`
        : 'Import a media plan to get started — Add New Campaign tab.';
    host.appendChild(el('div', { class: 'panel' }, el('div', { class: 'empty' },
      el('strong', {}, filtered ? 'Nothing matches' : 'Nothing booked in this period'),
      el('div', {}, why))));
    return;
  }

  /* The chart always shows the full plan range, whatever single month is
     selected above — a one-month bar chart tells you nothing. */
  const series = monthlySeries(state.filters, side);

  host.appendChild(el('div', { class: 'grid-2' },
    panel('Budget vs. spend by month',
      side === 'internal'
        ? 'What GMS pays the media owner · AUD · media-plan budget against actual spend'
        : 'What the client is billed · AUD · booked budget against delivered spend',
      el('div', { class: 'body' }, monthlyBars(series)),
      state.ym ? tagline(state) : null),

    panel('Where the budget goes',
      state.ym ? `${monthLabel(state.ym)} · budget share and how much of it is spent`
        : 'Across the whole plan · budget share and how much of it is spent',
      el('div', { class: 'body' }, platformSplit(
        byPlatform(rows, side).sort((a, b) => b.budget - a.budget))))));

  /* Campaign-level first: an underspent month is a campaign-level decision,
     and it is what the team acts on before drilling into a line. */
  host.appendChild(panel('Campaign pacing',
    'Spend against the plan’s own schedule, across the whole flight. The tick on each track is where the schedule says you should be — the gap is what is still owed to the campaign.',
    el('div', { class: 'body' }, campaignPacing(campaignPace(state.filters, side)))));

  host.appendChild(panel('Lines needing attention',
    'More than 15% ahead of or behind their time elapsed. Click one to open it.',
    pacingAlerts(rows, side, (m) => openLine(m, rerender))));
}

function panel(title, sub, ...body) {
  return el('div', { class: 'panel' },
    el('header', {}, el('div', {}, el('h3', {}, title), el('p', {}, sub))),
    ...body);
}

function tagline(state) {
  return el('div', { class: 'body', style: { paddingTop: 0 } },
    el('div', { class: 'hint' },
      `Chart covers the whole plan. The cards and the list below are ${monthLabel(state.ym)} only.`));
}

/* ----------------------------------------------------------------- cards */

function summaryCards(rows, state) {
  const side = state.view;
  const t = totals(rows);

  /* Cards follow the filters. A platform with nothing booked and nothing spent
     gets no card — a row of $0 tiles reads as though the filter did nothing. */
  const present = byPlatform(rows, side).filter((p) => p.spend > 0 || p.budget > 0);
  const rank = (p) => {
    const i = CARD_PLATFORMS.indexOf(p.platform);
    return i >= 0 ? i : CARD_PLATFORMS.length + 1;
  };
  present.sort((a, b) => rank(a) - rank(b) || b.spend - a.spend);

  const LIMIT = 4;
  const shown = present.slice(0, LIMIT);
  const rest = present.slice(LIMIT);
  const wrap = el('div', { class: 'cards' });

  wrap.appendChild(card({
    cls: 'total',
    k: `Total spend · ${side === 'internal' ? 'internal' : 'client-facing'}`,
    v: money(t[side].spend),
    s: t[side].budget > 0
      ? `of ${money(t[side].budget)} budget · ${pct(t[side].pacingPct, 0)}`
      : 'no budget booked in this period',
    bar: t[side].pacingPct, color: 'var(--orange)',
    title: scopeLabel(state, rows),
  }));

  for (const p of shown) {
    wrap.appendChild(card({
      k: p.platform,
      v: money(p.spend),
      s: p.budget > 0 ? `of ${money(p.budget)} · ${pct(p.pacingPct, 0)}`
        : `${p.lines} line${p.lines > 1 ? 's' : ''} · no budget`,
      bar: p.pacingPct, color: PLATFORM_COLOR[p.platform] || 'var(--ink-3)',
    }));
  }

  if (rest.length) {
    const spend = rest.reduce((a, p) => a + p.spend, 0);
    const budget = rest.reduce((a, p) => a + p.budget, 0);
    wrap.appendChild(card({
      k: `${rest.length} other platform${rest.length > 1 ? 's' : ''}`,
      v: money(spend), s: rest.map((p) => p.platform).join(' · '),
      bar: budget > 0 ? spend / budget : null,
    }));
  }

  /* Two different facts, and conflating them is what made the old card
     contradict itself: individual lines can each blow their own booked budget
     while the campaign as a whole is still underspent. Say which one it is. */
  if (t.linesOver.length) {
    const n = t.linesOver.length;
    const names = t.linesOver.slice(0, 2)
      .map((r) => r.line.placement || r.line.platform || 'a line').join(', ');
    wrap.appendChild(card({
      cls: 'alert',
      k: `${n} line${n > 1 ? 's' : ''} past booked budget`,
      v: money(t.overspend),
      s: t.totalOverBooked > 0.5
        ? `and the total is over too — ${money(t.clientProrata)} run against ${money(t.budgetClient)} booked`
        : `${names}${n > 2 ? ` +${n - 2} more` : ''} · the total is still under (${money(t.clientProrata)} of ${money(t.budgetClient)})`,
      title: 'Client value at the plan margin, above what those lines had booked. '
        + 'A fixed-fee contract would cap them there; anything past it is GMS to absorb or to raise with the client.',
    }));
  } else if (side === 'client' && t.effMargin != null) {
    wrap.appendChild(card({
      k: 'Blended margin', v: pct(t.effMargin, 1),
      s: `${money(t.spendClient - t.spendInternal)} gross on ${money(t.spendClient)}`,
      color: 'var(--blue)',
    }));
  }

  return wrap;
}

function card({ k, v, s, bar, color, cls = '', title }) {
  const node = el('div', { class: 'card ' + cls, title: title || '' },
    el('div', { class: 'k' }, k),
    el('div', { class: 'v' }, v),
    el('div', { class: 's' }, s),
    bar == null ? null : el('div', { class: 'bar' },
      el('i', {
        style: {
          width: Math.min(100, Math.max(0, bar * 100)) + '%',
          background: bar > 1.15 ? 'var(--crit)' : (color || 'var(--ink-3)'),
        },
      })));
  if (color && !cls) node.style.setProperty('--rule', color);
  return node;
}

/** What the totals are actually counting, for the total tile's tooltip. */
function scopeLabel(state, rows) {
  const f = state.filters || {};
  const bits = [`${rows.length} line${rows.length === 1 ? '' : 's'}`, monthLabel(state.ym)];
  const named = [...new Set(rows.map((m) => m.clientName))];
  bits.push(named.length === 1 ? named[0] : `${named.length} clients`);
  for (const [k, label] of [['platform', 'platform'], ['objective', 'objective'], ['status', 'status']]) {
    if (f[k]) bits.push(`${label}: ${f[k]}`);
  }
  if (f.q) bits.push(`search: "${f.q}"`);
  return bits.join(' · ');
}
