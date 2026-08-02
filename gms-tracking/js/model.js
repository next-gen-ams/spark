/* View model — turns the stored tables plus the current filters into the rows
   the tracking table renders. Keeps store (I/O) and calc (maths) apart. */

import { all, index, fxMap, byId } from './store.js';
import { lineMetrics, monthBounds, todayIso, ymOf, totals, repace, effectiveStatus } from './calc.js';

export const emptyFilters = () => ({
  client: '', platform: '', objective: '', status: '', campaign: '', q: '',
});

/** Every month that any campaign or booking touches, ascending. */
export function monthsAvailable() {
  const set = new Set(all('line_month').map((m) => m.ym).filter(Boolean));
  for (const c of all('campaign')) {
    if (!c.start_date || !c.end_date) continue;
    let d = new Date(c.start_date.slice(0, 7) + '-01');
    const end = c.end_date.slice(0, 7);
    for (let i = 0; i < 60; i++) {
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      set.add(ym);
      if (ym >= end) break;
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    }
  }
  for (const s of all('spend')) if (s.date) set.add(ymOf(s.date));
  return [...set].sort();
}

/**
 * Build the scoped, filtered metric rows.
 * @param {object} state { ym, filters }
 */
export function buildRows(state) {
  const { ym, filters = emptyFilters() } = state;
  const fx = fxMap();
  const today = todayIso();
  const campaigns = new Map(all('campaign').map((c) => [c.id, c]));
  const clients = new Map(all('client').map((c) => [c.id, c]));
  const monthsBy = index('line_month', 'line_id');
  const spendBy = index('spend', 'line_id');
  const bounds = ym ? monthBounds(ym) : null;
  /* Defaulting the whole object only guards against it being absent; a caller
     that passes a partial one still reaches in. Cheap to survive. */
  const q = (filters.q || '').trim().toLowerCase();

  const out = [];
  for (const line of all('line')) {
    const campaign = campaigns.get(line.campaign_id);
    if (!campaign) continue;
    const client = clients.get(campaign.client_id);

    if (filters.client && campaign.client_id !== filters.client) continue;
    if (filters.campaign && line.campaign_id !== filters.campaign) continue;
    if (filters.platform && line.platform !== filters.platform) continue;
    if (filters.objective && line.objective !== filters.objective) continue;
    if (filters.status && effectiveStatus(line, campaign, today) !== filters.status) continue;
    /* Search covers everything a person might half-remember — the line, the
       supplier, the IO number, the KPI, a note — not just the campaign name. */
    if (q && !haystack(line, campaign, client).includes(q)) continue;

    const months = (monthsBy.get(line.id) || []).filter((m) => !ym || m.ym === ym);
    const spends = (spendBy.get(line.id) || [])
      .filter((s) => !bounds || (s.date >= bounds.start && s.date <= bounds.end));

    /* A month with neither a booking nor any spend isn't part of that month's
       plan — showing it would pad the table with empty rows. */
    if (ym && !months.length && !spends.length) continue;

    const m = lineMetrics(line, campaign, months, spends, { fx, ym, today });
    m.client_ = client;
    m.clientName = client?.name || '—';
    m.campaignName = campaign.name || '—';
    out.push(m);
  }

  out.sort((a, b) => a.clientName.localeCompare(b.clientName)
    || a.campaignName.localeCompare(b.campaignName)
    || (a.line.seq ?? 0) - (b.line.seq ?? 0));
  return out;
}

/** Everything about a line that free-text search should reach. */
function haystack(line, campaign, client) {
  return [
    client?.name, campaign.name, campaign.io_number, campaign.advertiser, campaign.am,
    line.platform, line.objective, line.placement, line.supplier, line.market,
    /* Effective, not stored: typing "completed" must find the lines that read
       Completed on screen, not the ones whose stored label happens to say so. */
    line.buy_method, line.kpi, line.landing_page, line.note,
    effectiveStatus(line, campaign), line.currency,
  ].filter(Boolean).join(' ').toLowerCase();
}

/** Distinct values present in the data, for the filter dropdowns. */
export function facets() {
  const lines = all('line');
  const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort();
  /* Statuses are the *effective* ones — the dropdown must offer exactly what
     the rows will say, or picking "Completed" would miss every line whose
     stored label never advanced past the import default. */
  const campaigns = new Map(all('campaign').map((c) => [c.id, c]));
  const today = todayIso();
  return {
    clients: all('client').slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    campaigns: all('campaign').slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    platforms: uniq(lines.map((l) => l.platform)),
    objectives: uniq(lines.map((l) => l.objective)),
    statuses: uniq(lines.map((l) => effectiveStatus(l, campaigns.get(l.campaign_id), today))),
  };
}

/**
 * Budget and spend for every month in range — the series behind the monthly
 * chart. Recomputed per month rather than cached: the data is small, and a
 * stale cache here would show a client the wrong number.
 */
export function monthlySeries(filters, side = 'internal') {
  return monthsAvailable().map((ym) => {
    const rows = buildRows({ ym, filters });
    const t = totals(rows);
    return { ym, budget: t[side].budget, spend: t[side].spend, lines: rows.length };
  });
}

/**
 * Re-pacing rolled up per campaign — the numbers behind the Overview panel
 * that tells the team what an underspent month leaves them to place.
 */
export function campaignPace(filters, side = 'internal', today = todayIso()) {
  const fx = fxMap();
  const clients = new Map(all('client').map((c) => [c.id, c]));
  const monthsBy = index('line_month', 'line_id');
  const spendBy = index('spend', 'line_id');
  const out = [];

  for (const campaign of all('campaign')) {
    if (filters.client && campaign.client_id !== filters.client) continue;
    if (filters.campaign && campaign.id !== filters.campaign) continue;

    const lines = all('line').filter((l) => l.campaign_id === campaign.id && l.billable !== false
      && (!filters.platform || l.platform === filters.platform)
      && (!filters.objective || l.objective === filters.objective));
    if (!lines.length) continue;

    const parts = lines
      .map((l) => repace(l, campaign, monthsBy.get(l.id) || [], spendBy.get(l.id) || [],
        { fx, today, side }))
      .filter(Boolean);
    if (!parts.length) continue;

    const sum = (k) => parts.reduce((a, p) => a + p[k], 0);
    out.push({
      campaignId: campaign.id,
      clientName: clients.get(campaign.client_id)?.name || '—',
      campaignName: campaign.name || '—',
      io: campaign.io_number || '',
      total: sum('total'), due: sum('due'), spent: sum('spent'),
      variance: sum('variance'), remaining: sum('remaining'),
      plannedThisMonth: sum('plannedThisMonth'), allowedThisMonth: sum('allowedThisMonth'),
      suggestedDaily: sum('suggestedDaily'),
      daysLeft: Math.max(...parts.map((p) => p.daysLeft)),
      finished: parts.every((p) => p.finished),
    });
  }
  /* Worst first — the top of this list is the day's work. */
  return out.sort((a, b) =>
    Math.abs(b.variance) / Math.max(b.due, 1) - Math.abs(a.variance) / Math.max(a.due, 1));
}

export const clientOf = (line) => {
  const c = byId('campaign', line.campaign_id);
  return c ? byId('client', c.client_id) : null;
};
