/* Excel export.
 *
 * One writer, two audiences:
 *
 *   internal — everything: margin, internal media cost, both unit rates, the
 *              raw spend log.
 *   client   — margin, internal cost, internal rates and non-billable lines
 *              are NOT written into the file. Not hidden columns, not white
 *              text — the columns are never added.
 *
 * Styling matches the UQ China Social export so the two sit together in a
 * client folder and read as one house: charcoal header band, orange rule under
 * the title block, banded rows, frozen header, autofilter, KMT sign-off.
 */

import { download, toast, monthLabel, money } from './dom.js';
import { all, where, byId } from './store.js';
import { totals, byPlatform, num } from './calc.js';
import { fileName } from './view-export.js';
import { GMS_LOGO_B64 } from './logo-b64.js';

/* ------------------------------------------------------------- house style */

const ORANGE   = 'FFE8590C';
const CHARCOAL = 'FF211F1C';
const MUTED    = 'FF7A7268';
const BAND     = 'FFFAF8F5';
const HAIRLINE = 'FFE4DFD8';
const WHITE    = 'FFFFFFFF';

const MONEY = '"$"#,##0.00';
const MONEY0 = '"$"#,##0';
const PCT = '0%';
const PCT1 = '0.0%';
const INTF = '#,##0';
const NUM0 = '0';

const ensureExcel = () => window.__loadExcel();
const stamp = () => new Date().toISOString().slice(0, 10);

/**
 * Lay a sheet out the way the UQ workbook does: an empty band, a two-line
 * title block under an orange rule, then the table from row 5.
 */
function layout(ws, { title, subtitle, cols }) {
  const span = cols.length;

  /* The GMS logo sits in the top band of every sheet — the client report
     doubly so, since that file travels under the GMS name. Added once per
     workbook, stamped per sheet; 600×124 source kept at its own ratio. */
  const wb = ws.workbook;
  if (wb.__gmsLogo == null) wb.__gmsLogo = wb.addImage({ base64: GMS_LOGO_B64, extension: 'png' });
  ws.getRow(1).height = 40;
  ws.addImage(wb.__gmsLogo, {
    tl: { col: 0.05, row: 0.15 }, ext: { width: 174, height: 36 }, editAs: 'oneCell',
  });

  ws.mergeCells(2, 1, 2, span);
  const t = ws.getCell(2, 1);
  t.value = title;
  t.font = { bold: true, size: 15, color: { argb: CHARCOAL } };
  t.alignment = { vertical: 'center' };
  ws.getRow(2).height = 21;

  ws.mergeCells(3, 1, 3, span);
  const s = ws.getCell(3, 1);
  s.value = subtitle;
  s.font = { size: 9.5, color: { argb: MUTED } };
  s.alignment = { vertical: 'center' };
  ws.getRow(3).height = 15;

  ws.getRow(4).height = 7;
  for (let c = 1; c <= span; c++) {
    ws.getCell(4, c).border = { bottom: { style: 'medium', color: { argb: ORANGE } } };
  }

  const head = ws.getRow(5);
  head.values = cols.map((c) => c.h);
  head.height = 22;
  head.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CHARCOAL } };
    cell.font = { bold: true, size: 9.5, color: { argb: WHITE } };
    cell.alignment = { horizontal: 'left', vertical: 'center', wrapText: true };
  });

  ws.columns = cols.map((c) => ({ width: c.w || 14 }));
  ws.views = [{ state: 'frozen', ySplit: 5, showGridLines: false }];
  ws.properties.tabColor = { argb: ORANGE };
  ws.pageSetup = { fitToPage: true, fitToWidth: 1, fitToHeight: 0, orientation: 'landscape' };
}

function writeRows(ws, cols, data) {
  let r = 6;
  for (const rec of data) {
    const row = ws.getRow(r);
    const banded = (r - 6) % 2 === 1;
    cols.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.value = rec[c.k] ?? null;
      if (c.fmt) cell.numFmt = c.fmt;
      cell.font = { size: 10, color: { argb: CHARCOAL } };
      cell.alignment = { vertical: 'top', wrapText: (c.w || 14) > 26 };
      cell.border = { bottom: { style: 'thin', color: { argb: HAIRLINE } } };
      if (banded) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BAND } };
    });
    r++;
  }
  return r;
}

function totalRow(ws, r, cols, rec, label) {
  const row = ws.getRow(r);
  cols.forEach((c, i) => {
    const cell = row.getCell(i + 1);
    cell.value = i === 0 ? label : (rec[c.k] ?? null);
    if (c.fmt && i > 0) cell.numFmt = c.fmt;
    cell.font = { bold: true, size: 10, color: { argb: CHARCOAL } };
    cell.border = { top: { style: 'thin', color: { argb: CHARCOAL } } };
  });
  return r + 1;
}

function signOff(ws, r, span) {
  ws.mergeCells(r, 1, r, Math.min(6, span));
  const c = ws.getCell(r, 1);
  c.value = 'Design & delivery by Kaleidoscope Management Technology · kmt.global';
  c.font = { size: 9, color: { argb: MUTED }, italic: true };
}

function finish(ws, lastDataRow, span) {
  if (lastDataRow > 6) {
    ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: lastDataRow - 1, column: span } };
  }
  signOff(ws, lastDataRow, span);
}

/* -------------------------------------------------------------- columns */

const COLS = {
  summaryInternal: [
    { h: 'Platform', k: 'platform', w: 16 },
    { h: 'Lines', k: 'lines', w: 8, fmt: NUM0 },
    { h: 'Budget — internal', k: 'bi', w: 17, fmt: MONEY0 },
    { h: 'Spend — internal', k: 'si', w: 17, fmt: MONEY },
    { h: 'Budget — client', k: 'bc', w: 17, fmt: MONEY0 },
    { h: 'Spend — client', k: 'sc', w: 17, fmt: MONEY },
    { h: 'Gross margin', k: 'gm', w: 15, fmt: MONEY },
    { h: 'Margin %', k: 'mp', w: 11, fmt: PCT1 },
    { h: 'Delivery', k: 'dl', w: 11, fmt: PCT },
  ],
  summaryClient: [
    { h: 'Platform', k: 'platform', w: 18 },
    { h: 'Campaigns', k: 'lines', w: 11, fmt: NUM0 },
    { h: 'Budget', k: 'bc', w: 15, fmt: MONEY0 },
    { h: 'Spend', k: 'sc', w: 15, fmt: MONEY },
    { h: 'Remaining', k: 'rem', w: 15, fmt: MONEY },
    { h: 'Delivery', k: 'dl', w: 11, fmt: PCT },
  ],
  linesInternal: [
    { h: 'Month', k: 'month', w: 13 },
    { h: 'Client', k: 'client', w: 20 },
    { h: 'Campaign', k: 'campaign', w: 26 },
    { h: 'IO number', k: 'io', w: 22 },
    { h: 'Platform', k: 'platform', w: 12 },
    { h: 'Objective', k: 'objective', w: 14 },
    { h: 'Line', k: 'line', w: 34 },
    { h: 'Market', k: 'market', w: 12 },
    { h: 'Buy method', k: 'buy', w: 11 },
    { h: 'Budget internal (AUD)', k: 'bi', w: 18, fmt: MONEY0 },
    { h: 'Budget internal (local)', k: 'bl', w: 18, fmt: MONEY0 },
    { h: 'Currency', k: 'ccy', w: 9 },
    { h: 'Spend internal (local)', k: 'sl', w: 18, fmt: MONEY },
    { h: 'Spend internal (AUD)', k: 'si', w: 18, fmt: MONEY },
    { h: 'Margin %', k: 'mp', w: 10, fmt: PCT1 },
    { h: 'Budget client', k: 'bc', w: 15, fmt: MONEY0 },
    { h: 'Client spend', k: 'cp', w: 18, fmt: MONEY },
    { h: 'Capped at booked', k: 'cc', w: 17, fmt: MONEY },
    { h: 'Over booked budget', k: 'ov', w: 17, fmt: MONEY },
    { h: 'Margin realised', k: 'me', w: 14, fmt: PCT1 },
    { h: 'Impressions', k: 'imp', w: 13, fmt: INTF },
    { h: 'Clicks', k: 'clk', w: 11, fmt: INTF },
    { h: 'Booked rate — media', k: 'brm', w: 16, fmt: MONEY },
    { h: 'Booked rate — GMS', k: 'brg', w: 16, fmt: MONEY },
    { h: 'Actual rate — internal', k: 'ari', w: 17, fmt: MONEY },
    { h: 'Rate index', k: 'ri', w: 11, fmt: PCT },
    { h: 'Pacing', k: 'pc', w: 10, fmt: PCT },
    { h: 'Billable', k: 'nb', w: 10 },
    { h: 'Status', k: 'status', w: 12 },
    { h: 'Note', k: 'note', w: 34 },
  ],
  linesClient: [
    { h: 'Month', k: 'month', w: 13 },
    { h: 'Campaign', k: 'campaign', w: 28 },
    { h: 'Platform', k: 'platform', w: 12 },
    { h: 'Objective', k: 'objective', w: 14 },
    { h: 'Line', k: 'line', w: 38 },
    { h: 'Market', k: 'market', w: 12 },
    { h: 'Flight', k: 'flight', w: 22 },
    { h: 'Buy method', k: 'buy', w: 11 },
    { h: 'Budget', k: 'bc', w: 14, fmt: MONEY0 },
    { h: 'Spend', k: 'ccap', w: 14, fmt: MONEY },
    { h: 'Delivery', k: 'pcc', w: 10, fmt: PCT },
    { h: 'Impressions', k: 'imp', w: 13, fmt: INTF },
    { h: 'Clicks', k: 'clk', w: 11, fmt: INTF },
    { h: 'Booked rate', k: 'brg', w: 13, fmt: MONEY },
    { h: 'Delivered rate', k: 'arc', w: 14, fmt: MONEY },
    { h: 'vs booked', k: 'ric', w: 11, fmt: PCT },
    { h: 'Status', k: 'status', w: 12 },
  ],
  creative: [
    { h: 'Client', k: 'client', w: 20 },
    { h: 'Campaign', k: 'campaign', w: 26 },
    { h: 'Platform', k: 'platform', w: 12 },
    { h: 'Creative', k: 'creative', w: 32 },
    { h: 'Live from', k: 'from', w: 12 },
    { h: 'Spend', k: 'spend', w: 14, fmt: MONEY },
    { h: 'Impressions', k: 'imp', w: 13, fmt: INTF },
    { h: 'Clicks', k: 'clk', w: 11, fmt: INTF },
    { h: 'CTR', k: 'ctr', w: 10, fmt: PCT1 },
    { h: 'Preview', k: 'url', w: 36 },
  ],
  spendlog: [
    { h: 'Date', k: 'date', w: 12 },
    { h: 'Client', k: 'client', w: 20 },
    { h: 'Campaign', k: 'campaign', w: 24 },
    { h: 'Platform', k: 'platform', w: 12 },
    { h: 'Line', k: 'line', w: 30 },
    { h: 'Creative', k: 'creative', w: 24 },
    { h: 'Currency', k: 'ccy', w: 9 },
    { h: 'Spend internal', k: 'sp', w: 15, fmt: MONEY },
    { h: 'Impressions', k: 'imp', w: 13, fmt: INTF },
    { h: 'Clicks', k: 'clk', w: 11, fmt: INTF },
    { h: 'Note', k: 'note', w: 30 },
  ],
};

/* ----------------------------------------------------------------- write */

/**
 * @param {object} cfg
 *   audience 'internal' | 'client'
 *   client   the client row (client reports only)
 *   rows     lineMetrics, each carrying the `ym` it was scoped to
 *   from,to  'yyyy-mm'
 *   sheets   { summary, lines, creative, spendlog }
 */
export async function exportWorkbook(cfg) {
  await ensureExcel();
  const isClient = cfg.audience === 'client';

  /* A client report carries neither fee/production lines, nor months where a
     line was neither booked nor spent against — an all-zero row reads as
     missing data rather than as "nothing was scheduled". */
  const rows = isClient
    ? cfg.rows.filter((m) => m.billable && (m.budgetClient > 0 || m.spendClient > 0))
    : (cfg.includeNonBillable ? cfg.rows : cfg.rows.filter((m) => m.billable));

  if (!rows.length) { toast('Nothing to export in that selection', 'bad'); return; }

  const wb = new window.ExcelJS.Workbook();
  wb.creator = isClient ? 'Global Media Solutions' : 'GMS Digital — Tracking Dashboard';
  wb.created = new Date();

  const span = cfg.from === cfg.to
    ? monthLabel(cfg.from) : `${monthLabel(cfg.from)} – ${monthLabel(cfg.to)}`;
  const who = isClient ? (cfg.client?.name || 'Client') : 'All clients';
  const title = isClient ? `${who} — Campaign Report` : 'GMS Tracking — Internal';
  const subtitle = isClient
    ? `${span} · issued ${stamp()} · all figures AUD · prepared by Global Media Solutions`
    : `${span} · exported ${stamp()} · INTERNAL — contains margin and media cost · all figures AUD unless stated`;

  if (cfg.sheets.summary) sheetSummary(wb, rows, { isClient, title, subtitle });
  if (cfg.sheets.lines) sheetLines(wb, rows, { isClient, title, subtitle });
  if (cfg.sheets.creative) sheetCreative(wb, rows, { isClient, title, subtitle });
  if (!isClient && cfg.sheets.spendlog) sheetSpendLog(wb, rows, { title, subtitle });

  if (!wb.worksheets.length) { toast('Pick at least one sheet', 'bad'); return; }

  const name = fileName(cfg.audience, cfg.client, cfg.from, cfg.to);
  const buf = await wb.xlsx.writeBuffer();
  download(name, new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }));
  toast(`Exported ${name}`);
}

/* ---------------------------------------------------------------- sheets */

function sheetSummary(wb, rows, { isClient, title, subtitle }) {
  const ws = wb.addWorksheet('Summary');
  const cols = isClient ? COLS.summaryClient : COLS.summaryInternal;
  layout(ws, { title: `${title} — Summary`, subtitle, cols });

  const pInt = byPlatform(rows, 'internal');
  const pCli = byPlatform(rows, 'client');
  const data = pInt.map((p) => {
    const q = pCli.find((x) => x.platform === p.platform) || { spend: 0, budget: 0 };
    return {
      platform: p.platform || '—', lines: p.lines,
      bi: p.budget || null, si: p.spend || null,
      bc: q.budget || null, sc: q.spend || null,
      rem: Math.max(0, q.budget - q.spend) || null,
      gm: (q.spend - p.spend) || null,
      mp: q.spend > 0 ? (q.spend - p.spend) / q.spend : null,
      dl: q.budget > 0 ? q.spend / q.budget : null,
    };
  });
  const end = writeRows(ws, cols, data);
  const t = totals(rows);
  const after = totalRow(ws, end, cols, {
    lines: rows.length,
    bi: t.budgetInternal || null, si: t.spendInternal || null,
    bc: t.budgetClient || null, sc: t.spendClient || null,
    rem: Math.max(0, t.budgetClient - t.spendClient) || null,
    gm: (t.spendClient - t.spendInternal) || null,
    mp: t.effMargin,
    dl: t.budgetClient > 0 ? t.spendClient / t.budgetClient : null,
  }, 'TOTAL');
  finish(ws, after, cols.length);
}

function sheetLines(wb, rows, { isClient, title, subtitle }) {
  const ws = wb.addWorksheet(isClient ? 'Campaign performance' : 'Line detail');
  const cols = isClient ? COLS.linesClient : COLS.linesInternal;
  layout(ws, { title: `${title} — ${isClient ? 'Performance' : 'Line detail'}`, subtitle, cols });

  const data = rows.map((m) => ({
    month: monthLabel(m.ym), client: m.clientName, campaign: m.campaignName,
    io: m.campaign.io_number || '',
    platform: m.line.platform, objective: m.line.objective,
    line: m.line.placement || m.line.supplier || '', market: m.line.market || '',
    flight: m.flight ? `${m.flight.start} – ${m.flight.end}` : '',
    buy: m.line.buy_method || '',
    bi: m.budgetInternal || null, bl: m.budgetCcy || null, ccy: m.ccy,
    sl: m.spendCcy || null, si: m.spendInternal || null,
    mp: m.margin || null, bc: m.budgetClient || null,
    cp: m.clientProrata || null, cc: m.clientCapped || null, ccap: m.clientCapped || null,
    ov: m.overspend || null,
    me: m.effMargin,
    imp: m.imp || null, clk: m.clicks || null,
    brm: m.line.rate_media, brg: m.line.rate_gms,
    ari: m.internal.actualRate, arc: m.client.actualRate,
    ri: m.internal.rateIndex, ric: m.client.rateIndex,
    pc: m.internal.pacingPct, pcc: m.client.pacingPct,
    nb: m.billable ? 'Yes' : 'No',
    status: m.line.status || '', note: m.line.note || '',
  }));
  finish(ws, writeRows(ws, cols, data), cols.length);
}

function sheetCreative(wb, rows, { isClient, title, subtitle }) {
  const data = [];
  const seen = new Set();
  for (const m of rows) {
    for (const c of where('creative', (x) => x.line_id === m.line.id)) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      const sp = where('spend', (s) => s.creative_id === c.id);
      const internal = sp.reduce((a, s) => a + num(s.spend_internal), 0) / m.rate;
      const imp = sp.reduce((a, s) => a + num(s.imp), 0);
      const clk = sp.reduce((a, s) => a + num(s.clicks), 0);
      if (!internal && !imp && !clk) continue;
      data.push({
        client: m.clientName, campaign: m.campaignName, platform: m.line.platform,
        creative: c.name || '', from: c.live_from || '',
        spend: isClient ? internal / (1 - (m.margin || 0)) : internal,
        imp: imp || null, clk: clk || null,
        ctr: imp > 0 ? clk / imp : null,
        url: c.preview_url || '',
      });
    }
  }
  if (!data.length) return;               // no creatives with spend — no sheet
  const ws = wb.addWorksheet('Creative breakdown');
  const cols = isClient ? COLS.creative.filter((c) => c.k !== 'client') : COLS.creative;
  layout(ws, { title: `${title} — Creative`, subtitle, cols });
  finish(ws, writeRows(ws, cols, data), cols.length);
}

function sheetSpendLog(wb, rows, { title, subtitle }) {
  const ws = wb.addWorksheet('Spend log');
  layout(ws, { title: `${title} — Spend log`, subtitle, cols: COLS.spendlog });

  const seen = new Set();
  const data = [];
  for (const m of rows) {
    for (const s of where('spend', (x) => x.line_id === m.line.id)) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      data.push({
        date: s.date, client: m.clientName, campaign: m.campaignName,
        platform: m.line.platform,
        line: m.line.placement || m.line.supplier || '',
        creative: s.creative_id ? (byId('creative', s.creative_id)?.name || '') : '',
        ccy: m.ccy, sp: num(s.spend_internal) || null,
        imp: num(s.imp) || null, clk: num(s.clicks) || null, note: s.note || '',
      });
    }
  }
  data.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  finish(ws, writeRows(ws, COLS.spendlog, data), COLS.spendlog.length);
}

/* ---------------------------------------------------------------- backup */

export function exportBackup() {
  const data = Object.fromEntries(['client', 'campaign', 'line', 'line_month',
    'creative', 'spend', 'vocab', 'fx', 'settings'].map((t) => [t, all(t)]));
  download(`tracking-backup-${stamp()}.json`,
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
}
