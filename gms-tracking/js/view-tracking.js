/* The tracking table + summary cards — the surface the requirement describes. */

import { el, money, int, pct, meter, tag, monthLabel, selectOrNew } from './dom.js';
import { CARD_PLATFORMS, PLATFORM_COLOR } from './config.js';
import { totals, byPlatform } from './calc.js';
import { put, vocab, addVocab } from './store.js';
import { openLine } from './drawer.js';

export function renderTracking(host, ctx) {
  const { rows, state, rerender } = ctx;
  host.appendChild(summaryCards(rows, state));
  host.appendChild(rows.length ? table(rows, state, rerender) : emptyState(state));
}

/* ----------------------------------------------------------------- cards */

function summaryCards(rows, state) {
  const side = state.view;                       // 'internal' | 'client'
  const t = totals(rows);

  /* Cards follow the filters. A platform with nothing booked and nothing spent
     in the current selection gets no card — a row of $0 tiles reads as though
     the filter did nothing. */
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
      s: p.budget > 0 ? `of ${money(p.budget)} · ${pct(p.pacingPct, 0)}` : `${p.lines} line${p.lines > 1 ? 's' : ''} · no budget`,
      bar: p.pacingPct, color: PLATFORM_COLOR[p.platform] || 'var(--ink-3)',
    }));
  }

  if (rest.length) {
    const spend = rest.reduce((a, p) => a + p.spend, 0);
    const budget = rest.reduce((a, p) => a + p.budget, 0);
    wrap.appendChild(card({
      k: `${rest.length} other platform${rest.length > 1 ? 's' : ''}`,
      v: money(spend),
      s: rest.map((p) => p.platform).join(' · '),
      bar: budget > 0 ? spend / budget : null,
    }));
  }

  /* The overspend card only exists when there is something to say. */
  if (t.overspend > 0.5) {
    wrap.appendChild(card({
      cls: 'alert',
      k: 'Over booked budget',
      v: money(t.overspend),
      s: `pro-rata client value ${money(t.clientProrata)} vs ${money(t.budgetClient)} booked`,
    }));
  } else if (side === 'client' && t.effMargin != null) {
    wrap.appendChild(card({
      k: 'Blended margin',
      v: pct(t.effMargin, 1),
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
  // The left rule carries the platform colour — that's what makes the row of
  // cards read as channels rather than as identical tiles.
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

/* ----------------------------------------------------------------- table */

const COLUMNS = [
  ['Client', 'wrap'], ['Platform', ''], ['Objective', ''], ['Campaign', 'wrap'],
  ['Monthly budget (AUD)', 'num'], ['Monthly budget (local)', 'num'],
  ['Daily budget', 'num'], ['Spend', 'num'],
  ['Buy method', ''], ['Total units', 'num'],
  ['Booked rate', 'num'], ['Actual rate', 'num'], ['Index', 'num'],
  ['Pacing', ''], ['Margin', 'num'], ['Status', ''],
];

const HELP = {
  'Monthly budget (AUD)': 'Booked budget for the period in view, from the media plan.',
  'Monthly budget (local)': 'Same budget converted at the IO exchange rate — what the media owner is topped up with.',
  'Daily budget': 'Remaining budget ÷ days left in the flight. Planned daily shown underneath.',
  Spend: 'Internal spend entered by the team; the client figure is derived from it via margin.',
  'Booked rate': 'Unit rate quoted in the media plan.',
  'Actual rate': 'CPM = spend ÷ impressions × 1000. CPC = spend ÷ clicks.',
  Index: 'Actual rate ÷ booked rate. Over 100% means the buy is running more expensive than quoted.',
  Pacing: 'Spend progress against time progress. The tick is where time sits.',
  Margin: 'Margin realised on actual spend. Blank until there is spend.',
};

function table(rows, state, rerender) {
  const side = state.view;
  const t = totals(rows);
  const body = el('tbody');

  let group = '';
  for (const m of rows) {
    const key = `${m.clientName} · ${m.campaignName}`;
    if (key !== group) {
      group = key;
      body.appendChild(el('tr', { class: 'grp' },
        el('td', { colspan: COLUMNS.length },
          `${m.clientName} — ${m.campaignName}`,
          m.campaign.io_number ? el('span', { class: 'muted' }, `   ${m.campaign.io_number}`) : null)));
    }
    body.appendChild(dataRow(m, side, rerender));
  }

  const foot = el('tfoot', {}, el('tr', {},
    el('td', { colspan: 4 }, `Total · ${rows.length} line${rows.length > 1 ? 's' : ''} · ${monthLabel(state.ym)}`),
    el('td', { class: 'num' }, money(t[side].budget)),
    el('td', { class: 'num muted' }, '—'),
    el('td', { class: 'num muted' }, '—'),
    el('td', { class: 'num' }, money(t[side].spend)),
    el('td', {}),
    /* Impressions and clicks are different units — showing one blended total
       would be a made-up number. */
    el('td', { class: 'num' },
      t.imp ? el('div', {}, int(t.imp), el('span', { class: 'muted' }, ' imp')) : null,
      t.clicks ? el('div', { style: { fontSize: '11px' } },
        int(t.clicks), el('span', { class: 'muted' }, ' clicks')) : null,
      !t.imp && !t.clicks ? '—' : null),
    el('td', {}), el('td', {}), el('td', {}),
    el('td', {}, pct(t[side].pacingPct, 0)),
    el('td', { class: 'num' }, side === 'client' ? pct(t.effMargin, 1) : '—'),
    el('td', {})));

  return el('div', { class: 'panel' },
    el('header', {},
      el('div', {},
        el('h3', {}, 'Campaign tracking'),
        el('p', {}, side === 'internal'
          ? 'Internal view — budgets and spend as paid to the media owner.'
          : 'Client-facing view — derived from internal spend at the plan margin.')),
      el('div', { class: 'spacer', style: { flex: 1 } }),
      t.overspend > 0.5
        ? tag(`${money(t.overspend)} over booked budget`, 'crit')
        : null),
    el('div', { class: 'tablewrap' },
      el('table', { class: 'data' },
        el('thead', {}, el('tr', {}, ...COLUMNS.map(([label, cls]) =>
          el('th', { class: cls, title: HELP[label] || '' }, label)))),
        body, foot)));
}

function dataRow(m, side, rerender) {
  const s = m[side];
  const line = m.line;
  const nb = !m.billable;

  const budgetLocal = m.ccy === 'AUD'
    ? null
    : money(side === 'internal' ? m.budgetCcy : m.budgetClient * m.rate, m.ccy);

  const spendCell = el('td', { class: 'num' },
    el('div', {}, money(s.spend)),
    m.ccy !== 'AUD' && side === 'internal'
      ? el('div', { class: 's muted', style: { fontSize: '11px' } }, money(m.spendCcy, m.ccy))
      : null,
    side === 'client' && m.overspend > 0.5
      ? el('div', { style: { fontSize: '11px', color: 'var(--crit)' } },
        `+${money(m.overspend)} over`)
      : null);

  return el('tr', { class: nb ? 'nb' : '', ondblclick: () => openLine(m, rerender) },
    el('td', { class: 'wrap' }, m.clientName),
    el('td', {}, line.platform
      ? el('span', { class: 'tag', style: { color: PLATFORM_COLOR[line.platform] || 'var(--ink-2)' } },
        el('span', { class: 'pd' }), line.platform)
      : el('span', { class: 'muted' }, '—')),
    el('td', {}, line.objective || el('span', { class: 'muted' }, '—')),
    el('td', {
      class: 'wrap',
      style: { cursor: 'pointer' },
      title: 'Open this line',
      onclick: () => openLine(m, rerender),
    },
    el('div', {}, line.placement || line.supplier || m.campaignName),
    line.market ? el('div', { class: 'muted', style: { fontSize: '11px' } }, line.market) : null),

    el('td', { class: 'num' }, money(s.budget)),
    el('td', { class: 'num muted' }, budgetLocal || '—'),

    el('td', { class: 'num', title: `Planned daily ${money(s.plannedDaily, 'AUD', 0)} · ${m.remainingDays} day(s) left` },
      nb ? '—' : money(s.suggestedDaily, 'AUD', 0),
      nb ? null : el('div', { class: 'muted', style: { fontSize: '11px' } },
        `plan ${money(s.plannedDaily, 'AUD', 0)}`)),

    spendCell,

    el('td', {}, line.buy_method || el('span', { class: 'muted' }, '—')),
    el('td', { class: 'num' }, s.units == null ? el('span', { class: 'muted' }, '—') : int(s.units)),
    el('td', { class: 'num' }, s.bookedRate == null ? '—' : money(s.bookedRate, 'AUD', 2)),
    el('td', { class: 'num' }, s.actualRate == null ? '—' : money(s.actualRate, 'AUD', 2)),
    el('td', { class: 'num' }, indexCell(s.rateIndex)),

    el('td', {}, el('div', { style: { display: 'flex', alignItems: 'center', gap: '7px' } },
      meter(s.pacingPct, m.timePct, s.flag),
      el('span', { class: 'muted', style: { fontSize: '11px' } }, pct(s.pacingPct, 0)))),

    el('td', { class: 'num' }, nb ? el('span', { class: 'muted' }, 'n/a')
      : (side === 'client' && m.effMargin != null ? pct(m.effMargin, 1) : pct(m.margin, 0))),

    el('td', {}, statusPicker(line, rerender)));
}

function indexCell(v) {
  if (v == null) return el('span', { class: 'muted' }, '—');
  const kind = v > 1.15 ? 'crit' : v < 0.85 ? 'good' : '';
  return el('span', { class: 'tag ' + kind, title: v > 1 ? 'Running more expensive than booked' : 'At or under the booked rate' },
    pct(v, 0));
}

function statusPicker(line, rerender) {
  return selectOrNew(line.status || 'Not started', vocab('status'), (v) => {
    addVocab('status', v);
    put('line', { id: line.id, status: v });
    rerender();
  });
}

function emptyState(state) {
  return el('div', { class: 'panel' }, el('div', { class: 'empty' },
    el('strong', {}, 'Nothing booked in this period'),
    el('div', {}, state.ym
      ? `No media-plan lines or spend fall inside ${monthLabel(state.ym)}. Try “All months”, or clear the filters.`
      : 'Import a media plan to populate the tracker — Import plan tab.')));
}
