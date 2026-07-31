/* Pure derivation layer. No DOM, no storage — every number the dashboard shows
   is computed here from (line + media-plan booking + internal spend + FX).

   The one rule that governs the whole app:

     margin% = (client cost − media cost) / client cost          [from the IO]
     client spend (AUD) = internal spend ÷ FX ÷ (1 − margin%)

   Verified against UQ's own workbook: 3388.89 CNY ÷ 4.3 ÷ (1 − 0.5) = 1576.23,
   which is the AUD figure UQ reports to the client for that boost.            */

import { PACING } from './config.js';

const DAY_MS = 86400000;

/* ------------------------------------------------------------------ dates */

export const iso = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

export const todayIso = () => iso(new Date());

export const ymOf = (isoDate) => (isoDate || '').slice(0, 7);

export const monthBounds = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return { start: `${ym}-01`, end: iso(new Date(y, m, 0)) };
};

export const daysBetween = (a, b) =>
  Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS) + 1;

/** Intersection of two inclusive ISO date ranges, or null if they don't meet. */
export const overlap = (a1, a2, b1, b2) => {
  const s = a1 > b1 ? a1 : b1;
  const e = a2 < b2 ? a2 : b2;
  return s <= e ? { start: s, end: e } : null;
};

/* --------------------------------------------------------------------- fx */

/** 1 AUD = perAud <ccy>, so converting to AUD is always a division. */
export const perAud = (ccy, fx, campaign) => {
  if (!ccy || ccy === 'AUD') return 1;
  if (campaign && campaign.fx_ccy === ccy && Number(campaign.fx_rate) > 0) {
    return Number(campaign.fx_rate);          // rate locked on the IO wins
  }
  const r = Number(fx?.[ccy]);
  return r > 0 ? r : 1;
};

export const toAud = (amt, ccy, fx, campaign) => num(amt) / perAud(ccy, fx, campaign);
export const fromAud = (aud, ccy, fx, campaign) => num(aud) * perAud(ccy, fx, campaign);

/* ------------------------------------------------------------------ margin */

export const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/** Client-facing AUD implied by an internal AUD cost at a given margin. */
export const grossUp = (internalAud, marginPct) => {
  const m = num(marginPct);
  if (m <= 0 || m >= 1) return num(internalAud);   // 0% or nonsensical → pass through
  return num(internalAud) / (1 - m);
};

/** Margin actually realised once real spend is known. */
export const effectiveMargin = (internalAud, clientAud) =>
  num(clientAud) > 0 ? 1 - num(internalAud) / num(clientAud) : null;

/* -------------------------------------------------------------- line maths */

/**
 * Everything the tracking table needs for one line item within a scope.
 *
 * @param {object}  line      line row
 * @param {object}  campaign  its campaign (for the IO-locked FX rate + flight)
 * @param {array}   months    line_month rows for this line, already scoped
 * @param {array}   spends    spend rows for this line, already scoped
 * @param {object}  ctx       { fx, ym|null, today }
 */
export function lineMetrics(line, campaign, months, spends, ctx) {
  const { fx, ym, today = todayIso() } = ctx;
  const ccy = line.currency || 'AUD';
  const rate = perAud(ccy, fx, campaign);
  const margin = num(line.margin_pct);

  /* ---- budget. Prefer the media plan's monthly split; fall back to the
     line total when a plan carries no month columns. */
  let budgetInternal = 0, budgetClient = 0, bookedUnits = 0, hasMonthRows = false;
  for (const m of months) {
    hasMonthRows = true;
    budgetInternal += num(m.budget_media);
    budgetClient += num(m.budget_gms);
    bookedUnits += num(m.units);
  }
  if (!hasMonthRows && !ym) {
    budgetInternal = num(line.cost_media);
    budgetClient = num(line.cost_gms);
    bookedUnits = num(line.booked_units);
  }
  /* A plan may book money without splitting units, or vice versa. */
  if (!bookedUnits && !ym) bookedUnits = num(line.booked_units);
  if (!budgetClient && budgetInternal) budgetClient = grossUp(budgetInternal, margin);

  /* ---- actuals */
  let spendCcy = 0, imp = 0, clicks = 0, days = 0;
  for (const s of spends) {
    spendCcy += num(s.spend_internal);
    imp += num(s.imp);
    clicks += num(s.clicks);
    if (num(s.spend_internal)) days++;
  }
  const spendInternal = spendCcy / rate;

  /* ---- client-facing, both readings (the overspend decision is a human one) */
  const clientProrata = line.billable === false ? 0 : grossUp(spendInternal, margin);
  const clientCapped = budgetClient > 0 ? Math.min(clientProrata, budgetClient) : clientProrata;
  const overspend = Math.max(0, clientProrata - clientCapped);

  /* ---- flight window, clipped to the month in view */
  const flight = flightWindow(line, campaign, ym);
  const totalDays = flight ? daysBetween(flight.start, flight.end) : 0;
  const elapsed = flight
    ? Math.min(totalDays, Math.max(0, daysBetween(flight.start, today < flight.start ? flight.start : today)))
    : 0;
  const remaining = Math.max(1, totalDays - elapsed + 1);
  const live = !!flight && today >= flight.start && today <= flight.end;

  const out = {
    line, campaign, ccy, rate, margin, billable: line.billable !== false,
    budgetInternal, budgetClient, budgetCcy: budgetInternal * rate,
    bookedUnits,
    spendInternal, spendCcy, spendClient: clientCapped, clientProrata, overspend,
    effMargin: effectiveMargin(spendInternal, clientCapped),
    imp, clicks, activeDays: days,
    flight, totalDays, elapsedDays: elapsed, remainingDays: remaining, live,
    timePct: totalDays ? Math.min(1, elapsed / totalDays) : null,
  };

  /* View-dependent numbers are computed for both sides; the UI picks one. */
  out.internal = side(out, 'internal');
  out.client = side(out, 'client');
  return out;
}

function side(m, which) {
  const isInt = which === 'internal';
  const budget = isInt ? m.budgetInternal : m.budgetClient;
  const spend = isInt ? m.spendInternal : m.spendClient;
  const booked = num(isInt ? m.line.rate_media : m.line.rate_gms);
  const method = (m.line.buy_method || '').toUpperCase();

  let units = null;
  if (method === 'CPM') units = m.imp;
  else if (method === 'CPC' || method === 'CPE') units = m.clicks;

  let actual = null;
  if (method === 'CPM' && m.imp > 0) actual = (spend / m.imp) * 1000;
  else if ((method === 'CPC' || method === 'CPE') && m.clicks > 0) actual = spend / m.clicks;

  const pacingPct = budget > 0 ? spend / budget : null;
  const pacingIndex = pacingPct != null && m.timePct ? pacingPct / m.timePct : null;

  return {
    budget, spend, units, bookedRate: booked || null, actualRate: actual,
    rateIndex: actual != null && booked > 0 ? actual / booked : null,
    remaining: Math.max(0, budget - spend),
    pacingPct, pacingIndex,
    plannedDaily: m.totalDays ? budget / m.totalDays : null,
    suggestedDaily: Math.max(0, budget - spend) / m.remainingDays,
    flag: pacingFlag(pacingIndex, m.billable),
  };
}

export function pacingFlag(index, billable = true) {
  if (!billable || index == null) return 'none';
  if (index > PACING.over) return 'over';
  if (index < PACING.under) return 'under';
  return 'ok';
}

/** Flight = the line's own dates if the plan gave any, else the campaign's,
    clipped to the month currently in view. */
export function flightWindow(line, campaign, ym) {
  const s = line.start_date || campaign?.start_date;
  const e = line.end_date || campaign?.end_date;
  if (!s || !e || s > e) return null;
  if (!ym) return { start: s, end: e };
  const b = monthBounds(ym);
  return overlap(s, e, b.start, b.end);
}

/* ------------------------------------------------------------ re-pacing */

/**
 * What a line *should* have spent by today, what it actually spent, and what
 * that means for the months still to run.
 *
 * A media plan books money month by month, but the money does not expire at
 * the end of each month — an underspent June is still owed to the campaign in
 * July. So the daily figure to aim at is never "this month's budget ÷ days in
 * month"; it is "everything not yet spent ÷ days still left in the flight",
 * which automatically carries a shortfall forward and absorbs an overspend.
 *
 * @param {array} months  line_month rows for the whole line, not one month
 * @returns {object|null} null when there is no flight to pace against
 */
export function repace(line, campaign, months, spends, { fx, today = todayIso(), side = 'internal' } = {}) {
  const flight = flightWindow(line, campaign, null);
  if (!flight) return null;

  const rate = perAud(line.currency || 'AUD', fx, campaign);
  const margin = num(line.margin_pct);
  const toClient = (aud) => (side === 'client' ? grossUp(aud, margin) : aud);

  const budgetOf = (m) => (side === 'client'
    ? (num(m.budget_gms) || grossUp(num(m.budget_media), margin))
    : num(m.budget_media));

  const total = months.reduce((a, m) => a + budgetOf(m), 0);
  if (!(total > 0)) return null;

  /* Booked to date: whole months already past, plus today's share of the
     current month. Half a month gone means half of that month is due. */
  const ym = today.slice(0, 7);
  let due = 0;
  for (const m of months) {
    if (!m.ym) continue;
    if (m.ym < ym) due += budgetOf(m);
    else if (m.ym === ym) {
      const b = monthBounds(m.ym);
      const days = daysBetween(b.start, b.end);
      const gone = Math.min(days, Math.max(0, daysBetween(b.start, today)));
      due += budgetOf(m) * (gone / days);
    }
  }
  due = Math.min(due, total);

  const spentLocal = spends.reduce((a, s) => a + num(s.spend_internal), 0);
  const spent = toClient(spentLocal / rate);

  const variance = spent - due;                 // negative = behind
  const remaining = Math.max(0, total - spent);
  const daysLeft = today > flight.end
    ? 0
    : Math.max(1, daysBetween(today > flight.start ? today : flight.start, flight.end));

  /* This month's original schedule, and what it becomes once the carried
     shortfall (or surplus) is folded in. */
  const thisMonth = months.find((m) => m.ym === ym);
  const plannedThisMonth = thisMonth ? budgetOf(thisMonth) : 0;
  const allowedThisMonth = Math.max(0, plannedThisMonth - variance);

  return {
    flight, total, due, spent, variance, remaining, daysLeft,
    onTrack: due > 0 ? spent / due : null,       // 1.0 = exactly to schedule
    plannedThisMonth,
    allowedThisMonth,
    plannedDaily: total / Math.max(1, daysBetween(flight.start, flight.end)),
    /* The number the team actually needs: what to run per day from here to
       land on budget. */
    suggestedDaily: daysLeft ? remaining / daysLeft : 0,
    finished: today > flight.end,
  };
}

/** Wording for the carried shortfall — the thing the team acts on. */
export function repaceAdvice(r) {
  if (!r) return null;
  const off = r.due > 0 ? r.variance / r.due : 0;
  if (r.finished) {
    return r.variance < -1
      ? { kind: 'crit', text: `Flight ended ${Math.abs(r.variance) > 0 ? 'underspent' : ''} — ${Math.abs(r.variance).toFixed(0)} AUD was never placed.` }
      : { kind: 'ok', text: 'Flight complete.' };
  }
  if (Math.abs(off) < 0.05) return { kind: 'ok', text: 'On schedule.' };
  if (r.variance < 0) {
    return {
      kind: Math.abs(off) > 0.25 ? 'crit' : 'warn',
      text: `Behind by ${Math.abs(r.variance).toFixed(0)} AUD. `
        + `${r.daysLeft} day${r.daysLeft === 1 ? '' : 's'} left — run ${r.suggestedDaily.toFixed(0)}/day to land on budget.`,
    };
  }
  return {
    kind: off > 0.25 ? 'crit' : 'warn',
    text: `Ahead by ${r.variance.toFixed(0)} AUD. `
      + `Ease to ${r.suggestedDaily.toFixed(0)}/day for the remaining ${r.daysLeft} day${r.daysLeft === 1 ? '' : 's'}.`,
  };
}

/* ------------------------------------------------------------- aggregation */

const SUM_KEYS = ['budgetInternal', 'budgetClient', 'budgetCcy', 'bookedUnits',
  'spendInternal', 'spendClient', 'clientProrata', 'overspend', 'imp', 'clicks'];

/** Roll a set of lineMetrics up into one total. Only additive fields are
    summed; rates are recomputed so a blended CPM stays honest. */
export function totals(rows) {
  const t = Object.fromEntries(SUM_KEYS.map((k) => [k, 0]));
  t.count = rows.length;
  for (const r of rows) {
    if (!r.billable) { t.count -= 0; }
    for (const k of SUM_KEYS) t[k] += num(r[k]);
  }
  t.effMargin = effectiveMargin(t.spendInternal, t.spendClient);
  t.internal = {
    budget: t.budgetInternal, spend: t.spendInternal,
    pacingPct: t.budgetInternal > 0 ? t.spendInternal / t.budgetInternal : null,
  };
  t.client = {
    budget: t.budgetClient, spend: t.spendClient,
    pacingPct: t.budgetClient > 0 ? t.spendClient / t.budgetClient : null,
  };
  return t;
}

/** Total spend per platform, for the summary cards. Fee and production lines
    carry no platform and are not media — they get no card. */
export function byPlatform(rows, which) {
  const map = new Map();
  for (const r of rows) {
    if (!r.line.platform || !r.billable) continue;
    const p = r.line.platform;
    const cur = map.get(p) || { platform: p, spend: 0, budget: 0, lines: 0 };
    cur.spend += num(r[which].spend);
    cur.budget += num(r[which].budget);
    cur.lines++;
    map.set(p, cur);
  }
  for (const v of map.values()) v.pacingPct = v.budget > 0 ? v.spend / v.budget : null;
  return [...map.values()];
}
