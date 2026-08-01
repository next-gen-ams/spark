/* Media plan (GMS QUOTATION / IO) reader.

   Plans built from the same template still differ in column layout, so
   nothing here is positional: columns are resolved by header text or, failing
   that, from the data itself (see mediaplan-columns.js), and the monthly
   booking groups are identified by *checking their sums against each line's
   own Net Media / Net GMS cost*. That last check matters — one plan in the
   wild labels both of its booking groups "Media Booking (Client)".

   The parser never writes. It returns a reviewable plan; commit() persists
   only the rows the user ticked.                                            */

import {
  PLATFORM_ALIASES, NON_BILLABLE_HINTS, SKIP_ROW_HINTS, BREAKDOWN_HINTS, MONTHS,
} from './config.js';
import { put, putMany, newId, addVocab, all } from './store.js';
import { resolveColumns, rememberedMap, memoryKey, FIELD } from './mediaplan-columns.js';

const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
const stripPunct = (s) => norm(s).replace(/[^a-z0-9%/ ]/g, '');

/* ------------------------------------------------------------ cell reading */

function cv(cell) {
  let v = cell?.value;
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if (v.error) return { __err: String(v.error) };
    if ('result' in v) v = v.result instanceof Date ? v.result : v.result;
    else if (Array.isArray(v.richText)) v = v.richText.map((t) => t.text).join('');
    else if ('text' in v) v = v.text;
    if (v && typeof v === 'object' && v.error) return { __err: String(v.error) };
  }
  return v;
}

const isErr = (v) => !!(v && typeof v === 'object' && v.__err);
const txt = (v) => (isErr(v) || v == null ? '' : (v instanceof Date ? '' : String(v).trim()));

function nv(v) {
  if (isErr(v) || v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/[,$\s]/g, '').replace(/%$/, '');
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return /%$/.test(String(v).trim()) ? n / 100 : n;
}

/* --------------------------------------------------------------- template */

/** The body starts under the row that names the first column. */
function findHeaderRow(ws) {
  for (let r = 1; r <= Math.min(ws.rowCount, 40); r++) {
    for (let c = 1; c <= Math.min(ws.columnCount, 20); c++) {
      const t = norm(txt(cv(ws.getCell(r, c))));
      if (t.startsWith('category/media') || t.startsWith('category / media')) return r;
    }
  }
  return 0;
}

/* ------------------------------------------------------------ month groups */

const MONTH_RE = new RegExp(`^(${MONTHS.join('|')})[a-z]*\\.?$`, 'i');

/** Find the row carrying month names, and every (column → month) pair on it. */
function findMonthRow(ws, headerRow, lastMainCol) {
  for (let r = headerRow; r <= headerRow + 3; r++) {
    const hits = [];
    for (let c = lastMainCol + 1; c <= ws.columnCount; c++) {
      const t = txt(cv(ws.getCell(r, c)));
      const m = t.match(MONTH_RE);
      if (m) hits.push({ col: c, month: MONTHS.findIndex((x) => x.toLowerCase() === m[1].toLowerCase().slice(0, 3)) });
    }
    if (hits.length >= 2) return { row: r, hits };
  }
  return null;
}

/** Split the month columns into contiguous runs — one run per booking group. */
function groupRuns(hits) {
  const runs = [];
  let cur = null;
  for (const h of hits) {
    if (cur && h.col === cur.at(-1).col + 1 && h.month === cur.at(-1).month + 1) cur.push(h);
    else { cur = [h]; runs.push(cur); }
  }
  return runs;
}

/* -------------------------------------------------------------- IO header */

/* Shared with the import preview, which withdraws this warning once the dates
   have been filled in by hand rather than leaving it contradicting the panel
   directly above it. */
export const WARN_NO_FLIGHT_DATES =
  'Campaign start/end date missing — flight defaults to the plan months.';

function readHeader(ws, headerRow) {
  const out = {};
  const want = {
    advertiser: /^advertiser$/i,
    name: /^campaign name$/i,
    start: /^campaign commence date$/i,
    end: /^campaign end date$/i,
    io_number: /^io number$/i,
    version: /^version$/i,
    am: /^gms ac?count management/i,
    am_email: /^gms contact email$/i,
    fx: /^exchange rate$/i,
  };
  const isLabel = (v) => Object.values(want).some((re) => re.test(txt(v)))
    || /^(billing|client po|advertiser|version|proposed on|updated on)/i.test(txt(v));
  const usable = (v) => v != null && !isErr(v) && (v instanceof Date || txt(v) !== '') && !isLabel(v);

  for (let r = 1; r < headerRow; r++) {
    for (let c = 1; c <= ws.columnCount; c++) {
      const label = txt(cv(ws.getCell(r, c)));
      if (!label) continue;
      for (const [key, re] of Object.entries(want)) {
        if (out[key] != null || !re.test(label)) continue;
        // The value sits to the right — but merged cells can push it a few
        // columns over, and a blank means this plan just didn't fill it in.
        for (let k = c + 1; k <= Math.min(c + 4, ws.columnCount); k++) {
          const v = cv(ws.getCell(r, k));
          if (usable(v)) { out[key] = v; break; }
        }
        // Exchange Rate is the one field the template prints above its value.
        if (out[key] == null && key === 'fx') {
          const below = cv(ws.getCell(r + 1, c));
          if (usable(below)) out[key] = below;
        }
      }
    }
  }
  return out;
}

/** Any "<CCY> - AUD | 4.3" rows sitting under the plan. */
function readFxTable(ws) {
  const fx = {};
  for (let r = 1; r <= ws.rowCount; r++) {
    for (let c = 1; c <= Math.min(ws.columnCount, 12); c++) {
      const m = txt(cv(ws.getCell(r, c))).match(/^([A-Za-z]{2,4})\s*-\s*AUD$/);
      if (!m) continue;
      for (let k = c + 1; k <= Math.min(c + 6, ws.columnCount); k++) {
        const n = nv(cv(ws.getCell(r, k)));
        if (n) { fx[m[1].toUpperCase()] = n; break; }
      }
    }
  }
  return fx;
}

/* ---------------------------------------------------------------- markets */

/* Markets arrive however the plan typed them. One reference plan carries CHINA,
 * India, Hong Kong, SIRI LANKA and FIJI at once — and because the filter keys
 * off the string, "CHINA" and "China" would be two different markets in the
 * dropdown.
 *
 * Place names are safe to re-case; supplier names are not. Several vendors
 * carry internal capitals that title case would flatten, which is why the same
 * treatment is deliberately not applied to `supplier`.
 */
const MARKET_FIXES = {
  'siri lanka': 'Sri Lanka',
  srilanka: 'Sri Lanka',
  'sri-lanka': 'Sri Lanka',
  hongkong: 'Hong Kong',
  'hong-kong': 'Hong Kong',
  'viet nam': 'Vietnam',
  phillipines: 'Philippines',
  philipines: 'Philippines',
  phillippines: 'Philippines',
};

/* Abbreviations, not words — "Uae" helps nobody. */
const MARKET_CAPS = new Set(['UAE', 'USA', 'US', 'UK', 'HK', 'NZ', 'PRC', 'SAR',
  'EU', 'SEA', 'APAC', 'ANZ', 'MENA', 'GCC', 'KSA', 'ROW', 'DACH', 'UK/IE']);

/* Lower-cased mid-name: "Republic of Korea", not "Republic Of Korea". */
const MARKET_SMALL = new Set(['of', 'and', 'the', 'de', 'da']);

/**
 * Title-case a market name and correct the spellings we have actually seen.
 * @param {string} raw the cell as typed on the plan
 */
export function normaliseMarket(raw) {
  const s = String(raw ?? '').trim().replace(/\s+/g, ' ');
  if (!s) return '';
  if (!/[A-Za-z]/.test(s)) return s;                 // a Chinese name is already right
  const fixed = MARKET_FIXES[s.toLowerCase()];
  if (fixed) return fixed;
  /* Mixed case was typed deliberately — "Hong Kong", "iOS", a brand. Only a
     name shouted in caps or mumbled in lower case gets re-cased. */
  if (s !== s.toUpperCase() && s !== s.toLowerCase()) return s;
  return s.split(' ').map((word, i) => {
    const up = word.toUpperCase();
    if (MARKET_CAPS.has(up)) return up;
    if (i > 0 && MARKET_SMALL.has(word.toLowerCase())) return word.toLowerCase();
    // Capitalise after a hyphen, slash or apostrophe too: "Asia-Pacific".
    return word.toLowerCase().replace(/(^|[-/'])([a-z])/g, (m, sep, ch) => sep + ch.toUpperCase());
  }).join(' ');
}

/* ------------------------------------------------------------------ dates */

function parseDate(v, endOfMonth = false) {
  if (v == null) return null;
  if (v instanceof Date) return isoOf(v);
  const s = String(v).trim();
  if (!s) return null;
  const monthOnly = /^[A-Za-z]{3,9}\.?,?\s*\d{4}$/.test(s);   // "Mar, 2026"
  const d = new Date(monthOnly ? s.replace(',', ' ') : s);
  if (Number.isNaN(d.getTime())) return null;
  if (monthOnly && endOfMonth) return isoOf(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  return isoOf(d);
}

const isoOf = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Month index → 'yyyy-mm', walking forward from the campaign start so a plan
    that crosses a new year still lands on the right one. */
function ymFor(monthIdx, startIso, endIso) {
  const y0 = startIso ? Number(startIso.slice(0, 4)) : new Date().getFullYear();
  const mm = String(monthIdx + 1).padStart(2, '0');
  const startYm = startIso ? startIso.slice(0, 7) : `${y0}-01`;
  const endYm = endIso ? endIso.slice(0, 7) : `${y0}-12`;
  /* Pick the year that lands this month inside the flight — a Feb–Dec plan
     with an empty Jan column means Jan of the same year, not the next one. */
  for (const y of [y0, y0 + 1, y0 - 1]) {
    const ym = `${y}-${mm}`;
    if (ym >= startYm && ym <= endYm) return ym;
  }
  return `${y0}-${mm}`;
}

/* ------------------------------------------------------------------ units */

/**
 * Plans disagree about what "Total Unit" means. Some put the real impression /
 * click count there; others put *thousands* of impressions (823.53) and keep
 * the real number in "Est. Impression / Clicks" (823,529). Reading the wrong
 * one silently multiplies CPM by 1000.
 *
 * So don't trust either header — work out how many units the quoted rate and
 * cost imply, and take whichever column is the right order of magnitude.
 */
export function pickUnits(total, est, rate, cost, method) {
  const cands = [total, est].filter((v) => v != null && v > 0);
  if (!cands.length) return total ?? est ?? null;
  if (cands.length === 1) return cands[0];

  const m = String(method || '').toUpperCase();
  if (!rate || !cost) return est;                 // no way to check — Est. is the safer default
  const implied = m === 'CPM' ? (cost / rate) * 1000 : cost / rate;
  if (!(implied > 0)) return est;

  const off = (v) => Math.abs(Math.log(v / implied));
  return cands.reduce((best, v) => (off(v) < off(best) ? v : best));
}

/* --------------------------------------------------------------- platform */

export function toPlatform(raw) {
  const s = norm(raw);
  if (!s) return '';
  const keys = Object.keys(PLATFORM_ALIASES).sort((a, b) => b.length - a.length);
  for (const k of keys) if (s.includes(k)) return PLATFORM_ALIASES[k];
  return String(raw).trim();
}

/* ----------------------------------------------------------------- parse */

export async function parseWorkbook(arrayBuffer, fileName, opts = {}) {
  const wb = new window.ExcelJS.Workbook();
  await wb.xlsx.load(arrayBuffer);

  const sheets = [];
  for (const ws of wb.worksheets) {
    const headerRow = findHeaderRow(ws);
    if (headerRow) sheets.push({ ws, headerRow });
  }
  if (!sheets.length) {
    return { ok: false, error: 'No “Category/Media” header row found — is this a GMS QUOTATION / IO plan?' };
  }
  const memory = opts.memory ?? rememberedMap(all('settings'));
  return {
    ok: true,
    fileName,
    sheets: sheets.map(({ ws, headerRow }) =>
      parseSheet(ws, headerRow, fileName, { memory, overrides: opts.overrides?.[ws.name] || {} })),
  };
}

/** Re-read one sheet after the user re-points a column. */
export function reparse(sheet, overrides) {
  return parseSheet(sheet.ws, sheet.headerRow, sheet.fileName,
    { memory: sheet.memory, overrides });
}

function parseSheet(ws, headerRow, fileName, { memory = {}, overrides = {} } = {}) {
  const warnings = [];
  /* Column sets differ per plan — one has no Market, another no KPI. Reading
     a column the plan doesn't have must yield null, not throw. */
  const at = (r, c) => (c ? cv(ws.getCell(r, c)) : null);
  const readCell = (r, c) => {
    const v = cv(ws.getCell(r, c));
    return isErr(v) ? null : (v instanceof Date ? '' : v);
  };
  const { cols, mapping, profiles, missing } = resolveColumns(ws, headerRow, readCell, { memory, overrides });
  const lastMainCol = Math.max(...Object.values(cols), headerRow);

  const head = readHeader(ws, headerRow);
  const startDate = parseDate(head.start);
  const endDate = parseDate(head.end, true);
  const fxTable = readFxTable(ws);
  const fxRate = nv(head.fx) || null;
  /* The IO header prints a bare rate with no currency. If the plan also
     carries a "<CCY> - AUD" table, the matching row names it; otherwise these
     are China plans and the rate is CNY. */
  const fxCcy = fxRate
    ? (Object.keys(fxTable).find((c) => Math.abs(fxTable[c] - fxRate) < 1e-6) || 'CNY')
    : null;

  const campaign = {
    name: txt(head.name) || fileName.replace(/\.xlsx?$/i, ''),
    advertiser: txt(head.advertiser),
    io_number: txt(head.io_number),
    version: txt(head.version),
    am: txt(head.am),
    am_email: txt(head.am_email),
    start_date: startDate,
    end_date: endDate,
    fx_ccy: fxCcy,
    fx_rate: fxRate,
    source_file: fileName,
  };
  if (fxCcy && fxTable[fxCcy] == null) fxTable[fxCcy] = fxRate;
  if (!startDate || !endDate) warnings.push(WARN_NO_FLIGHT_DATES);

  const mr = findMonthRow(ws, headerRow, lastMainCol);
  const runs = mr ? groupRuns(mr.hits) : [];

  /* ---- read the body */
  const raw = [];
  let objective = '';
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const category = txt(at(r, cols.category));
    const rateM = nv(at(r, cols.rate_media));
    const costM = nv(at(r, cols.cost_media));
    const costG = nv(at(r, cols.cost_gms));
    const costGtxt = txt(at(r, cols.cost_gms));
    const hasMoney = costM != null || costG != null || rateM != null;
    // A row of zeroes with no label is spreadsheet residue, not a line item.
    const realMoney = !!(costM || costG || rateM);

    if (!category && !realMoney) continue;

    const nc = norm(category);
    if (SKIP_ROW_HINTS.some((h) => nc === h || nc.startsWith(h))) {
      raw.push({ excelRow: r, category, kind: 'rollup' });
      continue;
    }
    if (category && !hasMoney) { objective = category; continue; }   // section header
    if (!category && !hasMoney) continue;

    raw.push({
      excelRow: r, kind: 'line', objective, category,
      supplier: txt(at(r, cols.supplier)),
      market: normaliseMarket(txt(at(r, cols.market))),
      placement: txt(at(r, cols.placement)) || txt(at(r, cols.rationale)),
      buy_method: txt(at(r, cols.buy_method)).replace(/^-$/, ''),
      plan_ccy: (txt(at(r, cols.currency)) || 'AUD').toUpperCase(),
      landing_page: txt(at(r, cols.landing_page)),
      kpi: txt(at(r, cols.kpi)),
      rate_media: rateM,
      rate_gms: nv(at(r, cols.rate_gms)),
      booked_units: pickUnits(
        nv(at(r, cols.booked_units)), nv(at(r, cols.est_units)),
        rateM, costM, txt(at(r, cols.buy_method))),
      cost_media: costM,
      cost_gms: costG,
      cost_gms_text: costGtxt,
      margin_pct: nv(at(r, cols.margin_pct)),
      _runs: runs.map((run) => run.map((h) => nv(cv(ws.getCell(r, h.col))) || 0)),
    });
  }

  /* ---- decide what each month-column group actually is, by checking sums */
  const roles = assignRuns(runs, raw, warnings);

  /**
   * Make each month's volume target agree with that month's money.
   *
   * Two things go wrong in real plans, and both produce nonsense efficiency:
   *
   *  - the plan has no monthly volume block at all, only money (one of the
   *    reference plans does exactly this), so every month's target is null; or
   *  - a row's monthly volume cells were copied from a neighbouring row, so
   *    the line claims a total its own budget cannot buy. Another carries
   *    16,400 clicks on three separate Baidu rows; it is right on the $25,317
   *    one and wrong on the $2,573 and $5,146 ones.
   *
   * The line total is trustworthy either way — pickUnits() already reconciles
   * it against rate x cost. So when the monthly figures do not add up to that
   * total, they are discarded and re-split by each month's share of the money,
   * which is what a planner would assume anyway. When they do add up, the
   * plan's own split is kept: it carries real seasonality this cannot invent.
   *
   * @returns {string} a warning to surface, or '' when the plan was believed
   */
  function reconcileMonthlyUnits(months, bookedUnits) {
    const budget = months.reduce((a, m) => a + (m.budget_media || 0), 0);
    if (!(bookedUnits > 0) || !(budget > 0)) return '';

    const stated = months.reduce((a, m) => a + (m.units || 0), 0);
    /* 2% covers rounding in the plan's own arithmetic, not a copied cell. */
    if (stated > 0 && Math.abs(stated - bookedUnits) <= bookedUnits * 0.02) return '';

    for (const m of months) m.units = bookedUnits * ((m.budget_media || 0) / budget);
    return stated > 0
      ? `monthly volume added up to ${Math.round(stated).toLocaleString()} against a booked `
        + `${Math.round(bookedUnits).toLocaleString()} — split by monthly budget instead`
      : 'plan gives no monthly volume — split by monthly budget';
  }

  /* ---- shape the reviewable rows */
  const rows = raw.filter((x) => x.kind === 'line').map((x) => {
    const nCat = norm(x.category), nSup = norm(x.supplier);
    const isBreakdown = BREAKDOWN_HINTS.some((h) => nCat.includes(h) || nSup.includes(h));
    const nonBillable = NON_BILLABLE_HINTS.some((h) => nCat.includes(h) || norm(x.objective).includes(h))
      || /bonus/i.test(x.cost_gms_text || '')
      || (x.cost_gms ?? 0) <= 0 && (x.cost_media ?? 0) > 0;

    const months = [];
    for (let g = 0; g < runs.length; g++) {
      const role = roles[g];
      if (!role) continue;
      runs[g].forEach((h, i) => {
        const val = x._runs[g][i] || 0;
        if (!val) return;
        const ym = ymFor(h.month, startDate, endDate);
        let rec = months.find((m) => m.ym === ym);
        if (!rec) { rec = { ym, units: 0, budget_media: 0, budget_gms: 0 }; months.push(rec); }
        if (role === 'units') rec.units += val;
        if (role === 'media') rec.budget_media += val;
        if (role === 'client') rec.budget_gms += val;
      });
    }
    months.sort((a, b) => a.ym.localeCompare(b.ym));
    const unitsNote = reconcileMonthlyUnits(months, x.booked_units);

    let margin = x.margin_pct;
    if (margin == null && x.cost_gms > 0 && x.cost_media != null) {
      margin = (x.cost_gms - x.cost_media) / x.cost_gms;
    }

    return {
      ...x,
      // A fee or production line has no media platform — leaving the raw
      // category in there would invent a platform in the summary cards.
      platform: nonBillable ? '' : toPlatform(x.category),
      billable: !nonBillable,
      margin_pct: nonBillable ? null : margin,
      months,
      units_note: unitsNote,
      include: !isBreakdown,
      flag: isBreakdown ? 'breakdown' : (nonBillable ? 'non-billable' : ''),
      reason: isBreakdown
        ? 'Breakdown / top-up row — this money is already on the parent line'
        : (nonBillable ? 'No client-facing cost — imported but excluded from pacing & efficiency' : ''),
    };
  });

  for (const r of rows) {
    if (r.include && r.units_note) {
      warnings.push(`Row ${r.excelRow} (${r.category}): ${r.units_note}.`);
    }
    if (r.include && r.billable && (r.margin_pct == null || r.margin_pct <= 0)) {
      warnings.push(`Row ${r.excelRow} (${r.category}) has no usable MARGIN % — client-facing spend will equal internal spend until you set one.`);
    }
    if (r.plan_ccy && r.plan_ccy !== 'AUD') {
      warnings.push(`Row ${r.excelRow} is quoted in ${r.plan_ccy}; costs are stored as-is. Check the FX before trusting the AUD columns.`);
    }
  }
  const skipped = raw.filter((x) => x.kind === 'rollup').length;
  if (skipped) warnings.push(`${skipped} Subtotal / Total row${skipped > 1 ? 's' : ''} skipped — they restate money already on the lines above.`);

  /* Does the monthly split add back up to the line totals? If it doesn't, the
     column groups were read wrong and the monthly budgets can't be trusted. */
  const inc = rows.filter((r) => r.include);
  const sum = (f) => inc.reduce((a, r) => a + (f(r) || 0), 0);
  const recon = {
    cost_media: sum((r) => r.cost_media),
    cost_gms: sum((r) => r.cost_gms),
    month_media: sum((r) => r.months.reduce((a, m) => a + (m.budget_media || 0), 0)),
    month_gms: sum((r) => r.months.reduce((a, m) => a + (m.budget_gms || 0), 0)),
  };
  const near = (a, b) => (!a && !b) || (b && Math.abs(a - b) / Math.abs(b) < 0.02);
  recon.ok = near(recon.month_media, recon.cost_media) && near(recon.month_gms, recon.cost_gms);
  if (!recon.ok && inc.length) {
    warnings.push('Monthly budgets do not add back up to the line totals — check the month columns below before importing.');
  }

  if (missing.length) {
    warnings.push(`Cannot import yet — ${missing.map((k) => FIELD[k].label).join(', ')} could not be found. Point at the right column below.`);
  }

  return {
    ws, fileName, memory, overrides,
    sheet: ws.name, headerRow, cols, mapping, profiles, missing,
    campaign, fxTable, warnings, rows, recon,
    // Used to pre-select the most plausible sheet in a multi-sheet workbook.
    quality: (missing.length ? 0 : inc.length * (recon.ok ? 10 : 1)) + (campaign.start_date ? 5 : 0),
    groups: runs.map((run, i) => ({
      role: roles[i] || 'ignored',
      months: run.map((h) => MONTHS[h.month]),
      from: run[0]?.col, to: run.at(-1)?.col,
    })),
  };
}

/**
 * Work out which month-column group is units / internal booking / client
 * booking by summing each group per row and matching it against that row's
 * Net Media Cost and Net GMS Cost. Labels are only a tiebreaker — one reference plan
 * labels both money groups "Media Booking (Client)".
 */
function assignRuns(runs, raw, warnings) {
  const lines = raw.filter((x) => x.kind === 'line');
  const score = runs.map(() => ({ media: 0, client: 0, units: 0 }));
  const close = (a, b) => a != null && b != null && b !== 0 && Math.abs(a - b) / Math.abs(b) < 0.02;

  for (const x of lines) {
    for (let g = 0; g < runs.length; g++) {
      const sum = x._runs[g].reduce((a, b) => a + b, 0);
      if (!sum) continue;
      if (close(sum, x.cost_media)) score[g].media++;
      if (close(sum, x.cost_gms)) score[g].client++;
      if (close(sum, x.booked_units)) score[g].units++;
    }
  }

  const roles = new Array(runs.length).fill(null);
  for (const role of ['units', 'media', 'client']) {
    let best = -1, bestScore = 0;
    for (let g = 0; g < runs.length; g++) {
      if (roles[g]) continue;
      if (score[g][role] > bestScore) { bestScore = score[g][role]; best = g; }
    }
    if (best >= 0) roles[best] = role;
  }
  /* Nothing matched (a plan with no per-line totals) — fall back to the
     conventional order: units, then internal booking, then client booking. */
  if (roles.every((r) => !r) && runs.length) {
    const order = runs.length >= 3 ? ['units', 'media', 'client'] : ['media', 'client'];
    order.forEach((r, i) => { if (i < runs.length) roles[i] = r; });
    warnings.push('Monthly booking columns could not be verified against the line totals — assigned by position. Check the monthly budgets after import.');
  }
  const unresolved = roles.filter((r) => !r).length;
  if (unresolved) warnings.push(`${unresolved} monthly column group ignored (did not match units, media cost or client cost).`);
  return roles;
}

/* ---------------------------------------------------------------- commit */

/**
 * Which currency the team actually tops this line's media owner up in.
 *
 * It belongs to the line, not the plan. One single plan buys Baidu and RED
 * inside China (paid in RMB) alongside a DSP across India, Hong Kong and
 * Singapore (paid in AUD) — one campaign-wide answer is wrong for half of it,
 * and it is wrong by a factor of 4.3.
 *
 * @param {object} line     a reviewed row
 * @param {string} fallback the plan-level answer, used when the platform says
 *                          nothing either way
 */
export function lineSpendCcy(line, fallback = 'AUD') {
  if (!line.billable) return 'AUD';
  const platform = `${line.platform || ''} ${line.category || ''}`;
  const market = line.market || '';

  /* Chinese inventory bought through an international rep and invoiced in AUD.
     Checked first and stated explicitly, because the platform on its own would
     say RMB and it would only land on AUD by the accident of the plan carrying
     no FX currency. IQIYI is bought via IPY — confirmed with Coco 2026-08-01. */
  if (/iqiyi/i.test(platform)) return 'AUD';

  /* These GMS tops up directly, in RMB and nothing else, wherever the audience
     sits. */
  if (/baidu|wechat|weibo|douyin|tencent|bilibili|xiaohongshu|\bred\b/i.test(platform)) return 'CNY';

  /* Otherwise the market decides: a DSP served into Singapore is paid for in
     AUD even on a plan whose other half is topped up in RMB. */
  if (market && !/china|prc|mainland|hong\s*kong|macau/i.test(market)) return 'AUD';

  /* No platform signal and no market — the plan-level answer is all there is.
     Settings ▸ per-campaign currency exists to correct this by hand. */
  return fallback;
}

/**
 * Persist a reviewed sheet. Only rows with include === true are written.
 * @param {object} sheet   a parseSheet() result, possibly edited in the preview
 * @param {object} opts    { clientId, spendCcy, campaignId? }
 */
export function commit(sheet, opts) {
  const { clientId, spendCcy = 'AUD' } = opts;
  const campaignId = opts.campaignId || newId('cmp');

  /* Remember how this workbook's headers map, so a plan with the same wording
     resolves itself next time — including anything the user pointed at. */
  for (const [field, m] of Object.entries(sheet.mapping || {})) {
    const header = sheet.profiles?.find((p) => p.col === m.col)?.header;
    if (header) put('settings', { k: memoryKey(header), v: field });
  }

  put('campaign', {
    id: campaignId,
    client_id: clientId,
    ...sheet.campaign,
    fx_ccy: sheet.campaign.fx_rate ? (sheet.campaign.fx_ccy || spendCcy) : null,
    imported_at: isoOf(new Date()),
  });

  const lines = [];
  const monthRows = [];
  let seq = 0;

  for (const r of sheet.rows) {
    if (!r.include) continue;
    const id = newId('ln');
    if (r.objective) addVocab('objective', r.objective);
    if (r.platform) addVocab('platform', r.platform);
    if (r.buy_method) addVocab('buy_method', r.buy_method);

    lines.push({
      id, campaign_id: campaignId, seq: seq++,
      objective: r.objective || '', platform: r.platform || '', supplier: r.supplier || '',
      market: r.market || '', placement: r.placement || '',
      buy_method: (r.buy_method || '').toUpperCase(),
      currency: lineSpendCcy(r, spendCcy),
      rate_media: r.rate_media, rate_gms: r.rate_gms,
      booked_units: r.booked_units,
      cost_media: r.cost_media, cost_gms: r.cost_gms,
      margin_pct: r.margin_pct,
      billable: r.billable,
      status: 'Not started',
      landing_page: r.landing_page || '', kpi: r.kpi || '',
      note: '',
    });

    for (const m of r.months) {
      monthRows.push({
        id: `${id}|${m.ym}`, line_id: id, ym: m.ym,
        units: m.units || null,
        budget_media: m.budget_media || null,
        budget_gms: m.budget_gms || null,
      });
    }
  }

  putMany('line', lines);
  putMany('line_month', monthRows);
  return { campaignId, lines: lines.length, months: monthRows.length };
}
