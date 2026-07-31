/* View model — turns the stored tables plus the current filters into the rows
   the tracking table renders. Keeps store (I/O) and calc (maths) apart. */

import { all, index, fxMap, byId } from './store.js';
import { lineMetrics, monthBounds, todayIso, ymOf } from './calc.js';

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
  const q = filters.q.trim().toLowerCase();

  const out = [];
  for (const line of all('line')) {
    const campaign = campaigns.get(line.campaign_id);
    if (!campaign) continue;
    const client = clients.get(campaign.client_id);

    if (filters.client && campaign.client_id !== filters.client) continue;
    if (filters.campaign && line.campaign_id !== filters.campaign) continue;
    if (filters.platform && line.platform !== filters.platform) continue;
    if (filters.objective && line.objective !== filters.objective) continue;
    if (filters.status && (line.status || 'Not started') !== filters.status) continue;
    if (q) {
      const hay = [client?.name, campaign.name, line.platform, line.objective,
        line.placement, line.supplier, line.market].join(' ').toLowerCase();
      if (!hay.includes(q)) continue;
    }

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

/** Distinct values present in the data, for the filter dropdowns. */
export function facets() {
  const lines = all('line');
  const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort();
  return {
    clients: all('client').slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    campaigns: all('campaign').slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    platforms: uniq(lines.map((l) => l.platform)),
    objectives: uniq(lines.map((l) => l.objective)),
    statuses: uniq(lines.map((l) => l.status || 'Not started')),
  };
}

export const clientOf = (line) => {
  const c = byId('campaign', line.campaign_id);
  return c ? byId('client', c.client_id) : null;
};
