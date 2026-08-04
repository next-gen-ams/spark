/* Charts, hand-drawn as SVG.
 *
 * No charting library: the whole page budget is 150kb and two vendored libs
 * already spend most of it. These are three shapes, and drawing them directly
 * means they inherit the theme tokens and stay crisp at any width.
 */

import { el, money, pct, monthLabel , shown } from './dom.js';
import { PLATFORM_COLOR } from './config.js';
import { resizable } from './resizable.js';

const SVGNS = 'http://www.w3.org/2000/svg';

function svgEl(tag, props = {}, ...kids) {
  const node = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, String(v));
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    node.appendChild(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

/* ---------------------------------------------------------------- tooltip */

let tip = null;
function showTip(evt, html) {
  if (!tip) {
    tip = el('div', {
      style: {
        position: 'fixed', zIndex: 80, pointerEvents: 'none',
        background: 'var(--header)', color: 'var(--header-tx)',
        padding: '7px 10px', borderRadius: '7px', fontSize: '11.5px',
        boxShadow: 'var(--shadow-lg)', maxWidth: '260px', lineHeight: 1.4,
      },
    });
    document.body.appendChild(tip);
  }
  tip.innerHTML = html;
  tip.style.display = 'block';
  const pad = 14;
  const x = Math.min(evt.clientX + pad, window.innerWidth - tip.offsetWidth - 8);
  const y = Math.max(8, evt.clientY - tip.offsetHeight - pad);
  tip.style.left = x + 'px';
  tip.style.top = y + 'px';
}
const hideTip = () => { if (tip) tip.style.display = 'none'; };
export const dismissTip = hideTip;

/* ------------------------------------------------------ budget vs. spend */

/**
 * Budget against actual spend, by month — the shape the team already reads on
 * the UQ dashboard. Ghost bar is what the media plan booked, solid is what was
 * actually spent, and it turns red the moment spend passes budget.
 *
 * @param {array} series [{ ym, budget, spend }]
 */
export function monthlyBars(series, { height = 230, currencyNote = '' } = {}) {
  if (!series.length) return el('div', { class: 'empty' }, 'No months in range.');

  const W = 1000, H = height, padB = 26, padT = 12;
  const max = Math.max(...series.flatMap((s) => [s.budget, s.spend]), 1);
  const plot = H - padB - padT;
  const slot = W / series.length;
  const barW = Math.min(26, slot * 0.3);
  const y = (v) => padT + plot - (v / max) * plot;

  const bars = series.flatMap((s, i) => {
    const cx = slot * (i + 0.5);
    const over = s.spend > s.budget && s.budget > 0;
    const label = `<b>${monthLabel(s.ym)}</b><br>`
      + `Budget ${money(s.budget)}<br>Spend ${money(s.spend)}`
      + (s.budget > 0 ? `<br>${pct(s.spend / s.budget, 0)} of budget` : '')
      + (over ? '<br><b>over budget</b>' : '');
    const hover = { onmousemove: (e) => showTip(e, label), onmouseleave: hideTip };
    return [
      svgEl('rect', {
        x: cx - barW - 2, y: y(s.budget), width: barW,
        height: Math.max(1, plot - (y(s.budget) - padT)),
        rx: 3, fill: 'var(--surface-2)', stroke: 'var(--line)', ...hover,
      }),
      svgEl('rect', {
        x: cx + 2, y: y(s.spend), width: barW,
        height: Math.max(s.spend > 0 ? 2 : 0, plot - (y(s.spend) - padT)),
        rx: 3, fill: over ? 'var(--crit)' : 'var(--orange)', ...hover,
      }),
      svgEl('text', {
        x: cx, y: H - 8, 'text-anchor': 'middle',
        'font-size': 12, fill: 'var(--ink-3)',
      }, monthLabel(s.ym).slice(0, 3)),
    ];
  });

  return el('div', {},
    svgEl('svg', {
      viewBox: `0 0 ${W} ${H}`, width: '100%', height,
      preserveAspectRatio: 'none', role: 'img',
      'aria-label': 'Budget against actual spend by month',
    },
    svgEl('line', { x1: 0, y1: padT + plot, x2: W, y2: padT + plot, stroke: 'var(--line)' }),
    ...bars),
    el('div', { class: 'legend' },
      legendKey('var(--surface-2)', 'Budgeted', true),
      legendKey('var(--orange)', 'Actual spend'),
      legendKey('var(--crit)', 'Over budget'),
      currencyNote ? el('span', { class: 'muted' }, currencyNote) : null));
}

function legendKey(colour, label, outlined) {
  return el('span', { class: 'lk' },
    el('i', { style: { background: colour, border: outlined ? '1px solid var(--line-2)' : 'none' } }),
    label);
}

/* --------------------------------------------------------- platform split */

/** Where the money is going, one bar per platform. */
export function platformSplit(rows) {
  if (!rows.length) return el('div', { class: 'empty' }, 'Nothing booked in this period.');
  const total = rows.reduce((a, p) => a + p.budget, 0);

  return el('div', { class: 'splitlist' }, ...rows.map((p) => {
    const share = total > 0 ? p.budget / total : 0;
    const used = p.budget > 0 ? p.spend / p.budget : 0;
    const colour = PLATFORM_COLOR[p.platform] || 'var(--ink-3)';
    return el('div', { class: 'splitrow' },
      el('div', { class: 'splithead' },
        el('span', { class: 'tag', style: { color: colour } },
          el('span', { class: 'pd' }), p.platform),
        el('span', { class: 'muted', style: { fontSize: '11px' } },
          `${pct(share, 0)} of budget`),
        el('span', { style: { marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' } },
          el('b', {}, money(p.spend)),
          el('span', { class: 'muted' }, ` / ${money(p.budget)}`))),
      el('div', { class: 'bar', title: `${pct(used, 0)} of this platform's budget spent` },
        el('i', {
          style: {
            width: Math.min(100, used * 100) + '%',
            background: used > 1.02 ? 'var(--crit)' : colour,
          },
        })));
  }));
}

/* ------------------------------------------------------------- pacing list */

/**
 * The lines that are off pace — the thing you actually act on. Sorted by how
 * far off they are, worst first, so the top of the list is the day's work.
 */
export function pacingAlerts(rows, side, onPick) {
  const flagged = rows
    .filter((m) => m.billable && m[side].pacingIndex != null && m[side].budget > 0)
    .map((m) => ({ m, idx: m[side].pacingIndex }))
    .filter((x) => x.idx > 1.15 || x.idx < 0.85)
    .sort((a, b) => Math.abs(Math.log(b.idx)) - Math.abs(Math.log(a.idx)));

  if (!flagged.length) {
    return el('div', { class: 'empty' },
      el('strong', {}, 'Everything is on pace'),
      el('div', {}, 'No line is more than 15% ahead of or behind its time elapsed.'));
  }

  const LIMIT = 12;
  return el('div', { class: 'tablewrap' }, resizable(el('table', { class: 'data fill-panel' },
    el('thead', {}, el('tr', {},
      el('th', {}, 'Client'), el('th', {}, 'Line'),
      el('th', { class: 'num' }, 'Spent'), el('th', { class: 'num' }, 'of budget'),
      el('th', { class: 'num' }, 'Time elapsed'), el('th', {}, ''), el('th', {}, ''))),
    el('tbody', {}, ...flagged.slice(0, LIMIT).map(({ m, idx }) => {
      const over = idx > 1;
      return el('tr', { style: { cursor: 'pointer' }, onclick: () => onPick && onPick(m) },
        el('td', { class: 'wrap' }, m.clientName),
        el('td', { class: 'wrap' }, shown(m.line.placement) || shown(m.line.supplier) || shown(m.line.objective) || '—',
          el('div', { class: 'muted', style: { fontSize: '11px' } },
            `${shown(m.line.platform)}${shown(m.line.objective) ? ' · ' + shown(m.line.objective) : ''}`)),
        el('td', { class: 'num' }, money(m[side].spend)),
        el('td', { class: 'num' }, pct(m[side].pacingPct, 0)),
        el('td', { class: 'num muted' }, pct(m.timePct, 0)),
        el('td', {}, el('span', { class: 'tag ' + (over ? 'crit' : 'warn') },
          over ? `${pct(idx - 1, 0)} ahead` : `${pct(1 - idx, 0)} behind`)),
        el('td', { class: 'wrap prose muted', style: { fontSize: '11px' } },
          over
            ? `will overspend by ~${money(m[side].budget * (idx - 1))}`
            : `~${money(m[side].budget - m[side].spend)} still to place`));
    })),
  /* The list is capped to keep the panel readable, but a silent cap reads as
     "that's all of them" — which is exactly wrong when the worst 12 are shown
     and more are hiding behind them. */
  flagged.length > LIMIT
    ? el('tfoot', {}, el('tr', {}, el('td', {
      colspan: 7, class: 'muted', style: { fontSize: '11.5px' },
    }, `…and ${flagged.length - LIMIT} more off pace. Filter by client or platform to see them.`)))
    : null), 'overview-alerts', [170, 260, 105, 100, 110, 120, 200]));
}

/* --------------------------------------------------- campaign re-pacing */

/**
 * Where each campaign stands against its own schedule, and what that means
 * for the months still to run.
 *
 * This is the "you underspent June, so July can carry more" panel. The plan's
 * monthly split is a schedule, not a set of expiring budgets — money not
 * placed in June is still owed to the campaign, and the daily figure to aim at
 * from here reflects that automatically.
 */
export function campaignPacing(groups, onPick) {
  if (!groups.length) {
    return el('div', { class: 'empty' }, 'No campaign has a flight to pace against yet.');
  }

  return el('div', { class: 'pacelist' }, ...groups.map((g) => {
    const behind = g.variance < -1;
    const ahead = g.variance > 1;
    const kind = !behind && !ahead ? 'good' : (Math.abs(g.variance) / Math.max(g.due, 1) > 0.25 ? 'crit' : 'warn');

    return el('div', { class: 'pacerow', style: { cursor: onPick ? 'pointer' : 'default' },
      onclick: () => onPick && onPick(g) },
    el('div', { class: 'pacehead' },
      el('b', {}, g.clientName),
      el('span', { class: 'muted' }, g.campaignName),
      g.io ? el('span', { class: 'muted', style: { fontSize: '11px' } }, g.io) : null,
      el('span', { style: { marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' } },
        el('b', {}, money(g.spent)), el('span', { class: 'muted' }, ` of ${money(g.total)}`))),

    /* Two marks on one track: how far through the money, and how far through
       the schedule. The gap between them IS the story. */
    el('div', { class: 'pacetrack', title: `Spent ${pct(g.total ? g.spent / g.total : 0, 0)} · scheduled ${pct(g.total ? g.due / g.total : 0, 0)}` },
      el('i', { style: { width: Math.min(100, (g.total ? g.spent / g.total : 0) * 100) + '%',
        background: ahead ? 'var(--crit)' : 'var(--orange)' } }),
      el('u', { style: { left: Math.min(100, (g.total ? g.due / g.total : 0) * 100) + '%' } })),

    el('div', { class: 'pacefoot' },
      el('span', { class: 'tag ' + kind },
        behind ? `${money(Math.abs(g.variance))} behind schedule`
          : ahead ? `${money(g.variance)} ahead of schedule` : 'on schedule'),
      g.finished
        ? el('span', { class: 'muted' }, 'flight finished')
        : el('span', { class: 'muted' },
          `${money(g.remaining)} left over ${g.daysLeft} day${g.daysLeft === 1 ? '' : 's'} — `,
          el('b', { style: { color: 'var(--ink)' } }, `run ${money(g.suggestedDaily)}/day`),
          g.plannedThisMonth > 0
            ? ` · this month can take ${money(g.allowedThisMonth)} (plan said ${money(g.plannedThisMonth)})`
            : '')));
  }));
}
