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

/* ------------------------------------------------------------- cumulative
 *
 * Every spend row is a SNAPSHOT: the running total for that line (or that
 * creative) from the day it went live up to the date on the row. It is not
 * that day's spend.
 *
 * This is how the media back-ends report — WeChat, RED and Baidu all show a
 * total consumed, not a daily delta — and it is what makes a missed day
 * harmless: skip three days and the next number you copy across is still
 * right, where a daily-delta model would have a hole in it.
 *
 * Two rules follow, and everything in this file obeys them:
 *
 *   · a figure "as at" a date is the LATEST snapshot on or before it,
 *     never a sum
 *   · spend across a period is the difference between two snapshots,
 *     `as at end` minus `as at the day before start`
 *
 * A line split by creative keeps one running total per creative, so the
 * line's figure is the sum of each creative's own latest snapshot. A creative
 * that stopped running keeps contributing its final total, which is correct:
 * the money was spent and did not go away.
 */

const dayBefore = (isoDate) => iso(new Date(Date.parse(isoDate) - DAY_MS));

/** The last snapshot in `rows` dated on or before `upTo` (all of them if not given). */
function latestAt(rows, upTo) {
  let best = null;
  for (const s of rows) {
    if (upTo && s.date > upTo) continue;
    /* Same date twice should not happen — the entry screen writes one row per
       line, creative and date — but tie-break anyway so the answer is stable. */
    if (!best || s.date > best.date || (s.date === best.date && String(s.id) > String(best.id))) {
      best = s;
    }
  }
  return best;
}

const zero = () => ({ spend: 0, imp: 0, clicks: 0, extra: {}, at: null, row: null });

const FIELDS = [['spend', 'spend_internal'], ['imp', 'imp'], ['clicks', 'clicks']];
const filled = (v) => v != null && v !== '';

/**
 * Read one bucket of snapshots as at a date — resolving EACH metric on its own.
 *
 * Not simply "the latest row". A tracker who fills spend today but leaves H5
 * clicks blank has not reported zero H5 clicks; the counter has not moved. So
 * every figure carries forward from the most recent snapshot that actually
 * carried it, and a blank is silence rather than a reading of nought.
 *
 * Partial entry is the normal case, not the edge case — the numbers live on
 * different screens in the media back-end and get copied across at different
 * times — so this is the difference between a dashboard that reads correctly
 * on a busy Tuesday and one that quietly zeroes a column.
 */
function resolveAt(rows, upTo) {
  const inRange = rows
    .filter((r) => !upTo || r.date <= upTo)
    .sort((a, b) => String(a.date).localeCompare(String(b.date))
      || String(a.id).localeCompare(String(b.id)));
  if (!inRange.length) return null;

  const out = zero();
  let touched = false;
  for (const r of inRange) {
    for (const [key, field] of FIELDS) {
      if (!filled(r[field])) continue;
      out[key] = num(r[field]); out.at = r.date; out.row = r; touched = true;
    }
    for (const [name, v] of Object.entries(r.extra || {})) {
      if (!filled(v)) continue;
      out.extra[name] = num(v); out.at = r.date; out.row = r; touched = true;
    }
  }
  /* Rows exist but every figure on them is blank: the line has been visited
     and reports nothing, which is not the same as never visited. */
  if (!touched) { out.row = inRange.at(-1); out.at = out.row.date; }
  return out;
}

/**
 * What a line reports as at `upTo`, and how that breaks down by creative.
 *
 * @param {array} spends  every spend row for the line, unfiltered by date
 * @param {string} [upTo] yyyy-mm-dd; omit for "whatever is the latest"
 * @returns {{spend, imp, clicks, extra, at, parts: Map<string, object>}}
 *   `parts` is keyed by creative id, with '' for figures recorded against the
 *   line itself. `at` is the most recent date that contributed — the line is
 *   settled to there.
 */
export function cumulative(spends, upTo) {
  const buckets = new Map();
  for (const s of spends) {
    const k = s.creative_id || '';
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(s);
  }

  const out = { ...zero(), parts: new Map() };
  for (const [k, rows] of buckets) {
    const part = resolveAt(rows, upTo);
    if (!part) continue;
    out.parts.set(k, part);
    out.spend += part.spend;
    out.imp += part.imp;
    out.clicks += part.clicks;
    for (const [name, v] of Object.entries(part.extra)) {
      out.extra[name] = (out.extra[name] || 0) + num(v);
    }
    /* The latest date anything was recorded. Creatives can be settled to
       different days — one that finished in June keeps its June figure — so
       this is "the newest information we have", not "every part agrees". */
    if (!out.at || part.at > out.at) out.at = part.at;
  }
  return out;
}

/**
 * Spend between two dates inclusive: the snapshot at the end, minus the
 * snapshot the day before the start.
 *
 * A creative created inside the window contributes nothing to the opening
 * snapshot, which is right — it had spent nothing before it existed.
 */
export function periodSpend(spends, start, end) {
  const to = cumulative(spends, end);
  const from = cumulative(spends, dayBefore(start));
  const extra = {};
  for (const k of new Set([...Object.keys(to.extra), ...Object.keys(from.extra)])) {
    extra[k] = (to.extra[k] || 0) - (from.extra[k] || 0);
  }
  return {
    spend: to.spend - from.spend,
    imp: to.imp - from.imp,
    clicks: to.clicks - from.clicks,
    extra,
    at: to.at,                       // the date this period is settled to
    opening: from,
    closing: to,
  };
}

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

  /* ---- actuals, read as snapshots rather than summed.
     `spends` arrives UNFILTERED by date — a period figure is the difference
     between two snapshots, so the one before the window opens is needed as
     much as the one that closes it. Filtering upstream, as an earlier version
     did, threw away the opening balance and made every month read as its own
     running total. */
  const window = ym ? monthBounds(ym) : null;
  const asAt = window ? (window.end < today ? window.end : today) : today;
  const view = window
    ? periodSpend(spends, window.start, asAt)
    : cumulative(spends, asAt);
  const spendCcy = view.spend;
  const imp = view.imp;
  const clicks = view.clicks;
  const extra = view.extra;
  /* The date the figures are settled to: the last day anyone recorded a
     number. A month with no entry on its final day is settled to whatever the
     last entry was, and says so rather than pretending to be complete. */
  const settledAt = view.at || null;
  const spendInternal = spendCcy / rate;

  /* Life-to-date is always the whole flight, whatever month is on screen —
     "spent to date" means exactly that. */
  const lifetime = cumulative(spends, today);

  /* ---- client-facing.
     The headline client figure is the pro-rata one: internal spend grossed up
     at the plan margin. It is therefore ALWAYS larger than the internal figure
     (margin > 0), which is the only reading that makes sense when you flip the
     view — a client number smaller than the internal one is nonsense.

     Capping at the booked budget is a separate, commercial question: if the
     contract is fixed-fee, anything past the booked amount is GMS's to absorb
     or to raise with the client. That reading is kept alongside, and the gap
     between them is surfaced, but it is not what the dashboard leads with. */
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
    spendInternal, spendCcy,
    spendClient: clientProrata,          // headline: never below the internal figure
    clientCapped,                        // what a fixed-fee contract would allow
    clientProrata, overspend,
    effMargin: effectiveMargin(spendInternal, clientProrata),
    imp, clicks, extra,
    settledAt,
    lifetimeCcy: lifetime.spend,
    lifetimeInternal: lifetime.spend / rate,
    lifetimeAt: lifetime.at || null,
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

/**
 * What each creative reports as at one date, for the entry screen.
 *
 * Two figures per creative, and the difference matters:
 *
 *   · `carried` — the running total as at this date, which is the latest
 *     snapshot on or before it. This is what the line is worth.
 *   · `typed`   — the snapshot recorded on THIS date exactly, or null.
 *
 * The entry screen puts `typed` in the box and `carried` beside it. Showing
 * the carried figure in the box instead would read as "recorded today" when
 * nobody had touched it, which is exactly the thing a month-end settlement
 * needs to be able to see.
 *
 * @param {array} creatives  the line's creatives
 * @param {array} spends     the line's spend rows, unfiltered by date
 * @param {string} date      yyyy-mm-dd
 */
export function daySplit(creatives, spends, date) {
  const known = new Set(creatives.map((c) => c.id));
  const rowsFor = (match) => spends.filter(match);
  const blank = { spend: 0, imp: 0, clicks: 0, extra: {} };

  const read = (rows) => {
    const carried = resolveAt(rows, date) || { ...blank, at: null, row: null };
    const typedRow = rows.find((s) => s.date === date) || null;
    return {
      ...carried,
      /* What was written on this date exactly, so the box shows what was
         entered rather than what was carried forward into it. */
      typed: typedRow ? {
        spend: num(typedRow.spend_internal), imp: num(typedRow.imp),
        clicks: num(typedRow.clicks), extra: { ...(typedRow.extra || {}) },
        raw: typedRow,
      } : null,
    };
  };

  const parts = creatives.map((c) => ({
    creative: c, ...read(rowsFor((s) => s.creative_id === c.id)),
  }));
  /* A creative_id pointing at something that no longer exists counts as loose,
     not as lost — but it keeps its OWN running total. Merging it with the
     line-level rows into one timeline and taking the latest would drop
     whichever was older, which is money quietly disappearing. Each orphan is
     resolved on its own and the results add. */
  const looseRows = rowsFor((s) => !s.creative_id || !known.has(s.creative_id));
  const looseBuckets = new Map();
  for (const r of looseRows) {
    const k = r.creative_id || '';
    if (!looseBuckets.has(k)) looseBuckets.set(k, []);
    looseBuckets.get(k).push(r);
  }
  const loose = { ...blank, extra: {}, at: null, row: null, typed: null };
  for (const rows of looseBuckets.values()) {
    const part = read(rows);
    loose.spend += part.spend; loose.imp += part.imp; loose.clicks += part.clicks;
    for (const [k, v] of Object.entries(part.extra)) loose.extra[k] = (loose.extra[k] || 0) + num(v);
    if (part.at && (!loose.at || part.at > loose.at)) { loose.at = part.at; loose.row = part.row; }
    /* Only line-level rows are editable on the entry screen; an orphan's
       figure is history, shown but not typed into. */
    if (part.typed && !rows[0].creative_id) loose.typed = part.typed;
  }

  const add = (k) => parts.reduce((a, p) => a + p[k], 0) + loose[k];
  const extra = {};
  for (const src of [...parts.map((p) => p.extra), loose.extra]) {
    for (const [k, v] of Object.entries(src)) extra[k] = (extra[k] || 0) + num(v);
  }
  /* The line's own settlement date is the newest of its parts'. */
  const at = [...parts.map((p) => p.at), loose.at].filter(Boolean).sort().at(-1) || null;

  return {
    split: creatives.length > 0,
    parts,
    loose,
    at,
    total: { spend: add('spend'), imp: add('imp'), clicks: add('clicks'), extra },
  };
}

/* ------------------------------------------------------------ custom KPIs */

/**
 * Evaluate one KPI column over a set of already-summed figures.
 *
 * The rule that makes this a function instead of a spreadsheet cell: **a rate
 * is always recomputed from sums, never aggregated from other rates.** Three
 * creatives at 2% CTR each make a line at 2% — not 6%, not whichever average
 * happens to be handy. Callers therefore pass totals for whatever level they
 * are rendering (a creative, a line, a month), and the division happens here,
 * once, at that level.
 *
 * @param {object} def  { kind:'counter'|'rate', id, num, den, per, format }
 *                      num/den are 'spend' | 'imp' | 'clicks' | a counter id
 * @param {object} t    { spend, imp, clicks, extra } — spend already in the
 *                      currency/side the caller wants the rate expressed in
 * @returns {number|null} null when the denominator is 0 — "no data yet",
 *                      which is not the same thing as a rate of zero
 */
/**
 * The spend figure a rate should divide by, for the side being viewed.
 *
 * Every money-based rate exists twice: what it costs GMS (internal) and what
 * it costs the client (internal grossed up at the line margin). A cost-per
 * that ignores the Internal ⇄ Client-facing toggle is quietly showing the
 * internal figure on a client-facing screen — the exact mix-up the two-sided
 * design exists to prevent.
 *
 * A non-billable line has no client-facing money at all, so its client-side
 * spend is null (renders as —), not zero — zero would read as "free".
 */
export function spendForSide(audInternal, side, margin, billable = true) {
  if (side !== 'client') return audInternal;
  if (!billable) return null;
  return grossUp(audInternal, margin);
}

export function kpiValue(def, t) {
  const pick = (ref) =>
    ref === 'spend' ? (t.spend == null ? null : num(t.spend))
      : ref === 'imp' ? num(t.imp)
        : ref === 'clicks' ? num(t.clicks)
          : num(t.extra?.[ref]);
  if (def.kind === 'counter') return pick(def.id);
  const den = pick(def.den);
  const n = pick(def.num);
  /* A null spend (no client-facing money on this side) poisons the whole
     rate — "—", never a phantom $0.00. */
  if (!den || n == null || den == null) return null;
  return (n / den) * (def.per || 1);
}

/**
 * The running total recorded against the line itself rather than any creative.
 *
 * Snapshots, so this is the latest such row — not a sum. Used when splitting a
 * line, to say how much money is already on it and has to go somewhere.
 */
export function looseSpendTotal(creatives, spends) {
  const known = new Set(creatives.map((c) => c.id));
  const buckets = new Map();
  for (const s of spends) {
    if (s.creative_id && known.has(s.creative_id)) continue;
    const k = s.creative_id || '';
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(s);
  }
  let total = 0;
  for (const rows of buckets.values()) {
    const row = latestAt(rows);
    if (row) total += num(row.spend_internal);
  }
  return total;
}

/**
 * The status a line should *display* — derived from its flight, not from the
 * label alone.
 *
 * `status` starts as 'Not started' at import and nobody comes back to advance
 * it, so a finished campaign was reaching client reports labelled Not started
 * next to 99% delivery. The two labels that just describe where the calendar
 * is ('Not started', 'Live') now come from the calendar; the labels that
 * record a human decision ('Paused', 'Stopped', an early 'Completed') stick,
 * because no date can know about them.
 */
export function effectiveStatus(line, campaign, today = todayIso()) {
  const stored = line.status || 'Not started';
  if (stored !== 'Not started' && stored !== 'Live') return stored;
  const f = flightWindow(line, campaign, null);
  if (!f) return stored;                       // no dates — nothing to derive from
  if (today < f.start) return 'Not started';
  if (today > f.end) return 'Completed';
  return 'Live';
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

  /* Snapshots, so the figure is the latest one, not the sum of them. */
  const spentLocal = cumulative(spends, today).spend;
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

  /* Tracking Entry is an execution surface, so it also needs the plan in the
     currency actually paid to the platform. This target deliberately closes
     at the END OF THIS MONTH: every earlier month's shortfall is carried into
     the current month, rather than spread invisibly across the whole flight. */
  const internalBudgetOf = (m) => num(m.budget_media);
  const monthPlanAud = thisMonth ? internalBudgetOf(thisMonth) : 0;
  const monthEndPlanAud = months
    .filter((m) => m.ym && m.ym <= ym)
    .reduce((a, m) => a + internalBudgetOf(m), 0);
  let dueInternalAud = 0;
  for (const m of months) {
    if (!m.ym || m.ym > ym) continue;
    if (m.ym < ym) { dueInternalAud += internalBudgetOf(m); continue; }
    const b = monthBounds(m.ym);
    const active = overlap(flight.start, flight.end, b.start, b.end);
    if (!active || today < active.start) continue;
    const elapsed = daysBetween(active.start, today < active.end ? today : active.end);
    dueInternalAud += internalBudgetOf(m) * (elapsed / daysBetween(active.start, active.end));
  }
  const spentInternalAud = spentLocal / rate;
  const monthWindow = overlap(flight.start, flight.end,
    monthBounds(ym).start, monthBounds(ym).end);
  const monthDaysLeft = !monthWindow || today > monthWindow.end ? 0
    : daysBetween(today > monthWindow.start ? today : monthWindow.start, monthWindow.end);
  const toMonthTargetAud = Math.max(0, monthEndPlanAud - spentInternalAud);

  return {
    flight, total, due, spent, variance, remaining, daysLeft,
    onTrack: due > 0 ? spent / due : null,       // 1.0 = exactly to schedule
    plannedThisMonth,
    allowedThisMonth,
    localMonthBudget: monthPlanAud * rate,
    localMonthTarget: monthEndPlanAud * rate,
    localDue: dueInternalAud * rate,
    localSpent: spentLocal,
    localVariance: (spentInternalAud - dueInternalAud) * rate,
    localToMonthTarget: toMonthTargetAud * rate,
    localSuggestedDaily: monthDaysLeft ? (toMonthTargetAud * rate) / monthDaysLeft : 0,
    monthDaysLeft,
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
  const $ = (n) => '$' + Math.round(Math.abs(n)).toLocaleString('en-AU');
  const days = (n) => `${n} day${n === 1 ? '' : 's'}`;

  if (r.finished) {
    if (r.variance < -1) {
      return { kind: 'crit', text: `Finished with ${$(r.variance)} unspent. That budget was never placed.` };
    }
    /* Overspend on a finished flight was falling through to "Finished on
       budget" — the one state where the commercial call (pro-rata vs capped)
       actually has to be made was the one state the advice column hid. */
    if (r.variance > 1) {
      return {
        kind: r.variance / Math.max(r.total, 1) > 0.05 ? 'crit' : 'warn',
        text: `Finished ${$(r.variance)} over budget. Open the line for the capped vs pro-rata client figures.`,
      };
    }
    return { kind: 'ok', text: 'Finished on budget.' };
  }
  if (Math.abs(off) < 0.05) return { kind: 'ok', text: 'On schedule.' };
  if (r.variance < 0) {
    return {
      kind: Math.abs(off) > 0.25 ? 'crit' : 'warn',
      text: `${$(r.variance)} behind. Lift to ${$(r.suggestedDaily)}/day over the last ${days(r.daysLeft)} to land on budget.`,
    };
  }
  return {
    kind: off > 0.25 ? 'crit' : 'warn',
    text: `${$(r.variance)} ahead. Ease to ${$(r.suggestedDaily)}/day over the last ${days(r.daysLeft)}.`,
  };
}

/* ------------------------------------------------------------- aggregation */

const SUM_KEYS = ['budgetInternal', 'budgetClient', 'budgetCcy', 'bookedUnits',
  'spendInternal', 'spendClient', 'clientCapped', 'clientProrata', 'overspend',
  'imp', 'clicks'];

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
  /* Overspend is a per-line fact — one line can blow its budget while the
     campaign as a whole is underspent. Carry the count so the card can say
     which it is instead of implying the total is over. */
  t.linesOver = rows.filter((r) => r.overspend > 0.5);
  t.totalOverBooked = Math.max(0, t.clientProrata - t.budgetClient);
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
