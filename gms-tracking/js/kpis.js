/* Custom KPI columns.
 *
 * The media plan says what was bought; it rarely says what the person running
 * the campaign wants to watch. H5 page clicks, follower growth, form submits —
 * whoever answers for performance decides what to track, per month, per whim.
 * So columns are added on demand from Tracking Entry, not preconfigured.
 *
 * Two kinds, and the distinction is load-bearing:
 *
 *   counter — a number you type (H5 clicks, followers gained). On a split
 *             line it sums from the creatives exactly like spend does.
 *   rate    — a number the app computes (CTR, CPM, cost per H5 click). Never
 *             typed, never summed: recomputed from totals at whatever level
 *             it is shown. See calc.kpiValue for why.
 *
 * The smart part of the flow: creating a counter offers its companion rates
 * in the same dialog — type "H5 clicks", tick "Cost per H5 clicks", done.
 * That is the workflow Coco described: record the conversion, get the cost-per
 * for free.
 *
 * Definitions live in settings (k = 'kpis'), so they survive the go-live wipe
 * with the rest of the team's setup, and they are global across clients —
 * a column a tracker adds for one campaign is simply empty on the others.
 * Values live on the spend rows themselves (spend.extra), so they flow through
 * daily entry, creative splits and monthly scoping like every other figure.
 */

import { all, put, newId } from './store.js';

const KEY = 'kpis';

/** Every defined column, counters first, stable order. */
export function kpiDefs() {
  try {
    const row = all('settings').find((s) => s.k === KEY);
    const v = row ? JSON.parse(row.v) : [];
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

export function saveKpiDefs(defs) {
  put('settings', { k: KEY, v: JSON.stringify(defs) });
}

export function addKpi(def) {
  const defs = kpiDefs();
  defs.push({ ...def, id: def.id || newId('k') });
  saveKpiDefs(defs);
  return defs.at(-1);
}

/** Remove the definition only — typed values stay on the spend rows, so
    re-adding the column later brings the history back. */
export function removeKpi(id) {
  saveKpiDefs(kpiDefs().filter((d) => d.id !== id && d.den !== id && d.num !== id));
}

/* --------------------------------------------------------------- presets */

/** The three classics, expressed in the same shape as user-made rates. */
export const PRESETS = [
  { name: 'CTR', kind: 'rate', num: 'clicks', den: 'imp', per: 1, format: 'pct' },
  { name: 'CPM', kind: 'rate', num: 'spend', den: 'imp', per: 1000, format: 'money' },
  { name: 'CPC', kind: 'rate', num: 'spend', den: 'clicks', per: 1, format: 'money' },
];

export const hasPreset = (p) => kpiDefs().some((d) =>
  d.kind === 'rate' && d.num === p.num && d.den === p.den && (d.per || 1) === (p.per || 1));

/** Companion rates offered when a counter is created. */
export function companionsFor(counterName, counterId) {
  return [
    {
      name: `Cost per ${counterName}`, kind: 'rate',
      num: 'spend', den: counterId, per: 1, format: 'money',
      blurb: 'spend ÷ ' + counterName,
    },
    {
      name: `${counterName} rate`, kind: 'rate',
      num: counterId, den: 'clicks', per: 1, format: 'pct',
      blurb: counterName + ' ÷ clicks',
    },
  ];
}

/* ------------------------------------------------------------- formatting */

const BASE_LABEL = { spend: 'spend (AUD)', imp: 'impressions', clicks: 'clicks' };

/** "clicks ÷ impressions", for tooltips — the column explains itself. */
export function kpiFormula(def, defs = kpiDefs()) {
  if (def.kind === 'counter') return 'Typed in, like clicks. On a split line it sums from the creatives.';
  const nameOf = (ref) => BASE_LABEL[ref] || defs.find((d) => d.id === ref)?.name || '?';
  return `${nameOf(def.num)} ÷ ${nameOf(def.den)}${def.per && def.per !== 1 ? ` × ${def.per}` : ''}`;
}

export function formatKpi(def, v, { money, int, pct }) {
  if (v == null) return '—';
  if (def.kind === 'counter') return int(v);
  /* Screen money is whole dollars — with one carve-out: a unit rate under
     $10 (a CPC of $0.45, a CPM of $3.20) rounds to nothing at 0dp, and a
     column of $0s reads as "free". Below $10 the cents ARE the number. */
  if (def.format === 'money') return money(v, 'AUD', v < 10 ? 2 : 0);
  if (def.format === 'pct') return pct(v, 2);
  return int(v);
}
