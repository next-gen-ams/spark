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
import { all, where, byId, loadCreativeImages } from './store.js';
import { totals, byPlatform, num, effectiveStatus, looseSpendTotal, kpiValue, cumulative, grossUp } from './calc.js';
import { kpiDefs } from './kpis.js';
import { campaignLog } from './notes.js';
import { fileName } from './view-export.js';
import { GMS_LOGO_B64 } from './logo-b64.js';
import { imageSize } from './paste-image.js';

/* ------------------------------------------------------------- house style */

const ORANGE   = 'FFE8590C';
const CHARCOAL = 'FF211F1C';
const MUTED    = 'FF7A7268';
const BAND     = 'FFFAF8F5';
const HAIRLINE = 'FFE4DFD8';
const WHITE    = 'FFFFFFFF';

/* Excel keeps two decimals on every money and percentage figure (Coco,
   2026-08-02) — a file is worked in at arm's length, and reconciliation
   happens to the cent. The screen is where decimals are dropped, not here.
   MONEY0/PCT/PCT1 stay as names so column definitions keep reading naturally,
   but they all resolve to two decimals now. */
const MONEY = '"$"#,##0.00';
const MONEY0 = MONEY;
const PCT = '0.00%';
const PCT1 = '0.00%';
const PCT2 = '0.00%';
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
      /* An image column's value is a data URL — the picture is anchored over
         the cell afterwards; printing the URL as text would be gibberish. */
      cell.value = c.image ? null : (rec[c.k] ?? null);
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

/* ------------------------------------------------------------ KPI columns
 *
 * Custom columns are not a bonus feature of one sheet — whoever added a column
 * added it because it is how they judge the campaign, so it belongs on every
 * sheet where the underlying figures appear. These helpers keep the four
 * sheets from drifting apart: one definition of the columns, one definition of
 * how a value is produced.
 *
 * Counters go everywhere, including the raw spend log (they are typed, so the
 * log of typed values must show them). Rates go on the aggregate sheets only —
 * a rate is a property of a set of rows, and the log's rows are single days.
 */
function kpiColumns(defs, { ratesToo = true, base = [] } = {}) {
  /* A user column can collide with one a sheet already has — Creative
     breakdown ships a built-in CTR, and adding the CTR preset produced two
     identical columns side by side. The sheet's own column wins; the
     duplicate is dropped rather than printed twice. */
  const taken = new Set(base.map((c) => String(c.h).toLowerCase()));
  return defs
    .filter((d) => (d.kind === 'counter' ? true : ratesToo))
    .filter((d) => !taken.has(String(d.name).toLowerCase()))
    .map((d) => ({
      h: d.name, k: `kpi_${d.id}`, w: 14,
      fmt: d.kind === 'counter' ? INTF : d.format === 'pct' ? PCT2 : MONEY,
    }));
}

/** Values for one row of KPI cells, given already-summed figures. */
function kpiCells(defs, t, { ratesToo = true } = {}) {
  const out = {};
  for (const d of defs) {
    if (d.kind !== 'counter' && !ratesToo) continue;
    out[`kpi_${d.id}`] = kpiValue(d, t);
  }
  return out;
}

/**
 * Drop optional columns that are blank on every row.
 *
 * "Live from" and "Preview" are per-creative notes nobody is obliged to fill,
 * and a column of nothing in a client report does not read as "not applicable"
 * — it reads as unfinished work. Only columns marked `opt` are ever dropped;
 * every money column stays put whatever its values, so the file's financial
 * shape never changes between exports.
 */
function pruneEmpty(cols, data) {
  return cols.filter((c) => !c.opt
    || data.some((r) => r[c.k] !== null && r[c.k] !== undefined && r[c.k] !== ''));
}

/**
 * Anchor the stored thumbnails over their cells and give those rows room.
 *
 * Excel images float above the grid rather than living in a cell, so the row
 * has to be made tall enough by hand or the picture spills over its
 * neighbours. Sized to fit the column at its natural aspect ratio.
 */
function placeThumbnails(ws, wb, cols, data) {
  const ci = cols.findIndex((c) => c.image);
  if (ci < 0) return;
  const colWidthPx = (cols[ci].w || 26) * 7;          // Excel width unit ≈ 7px
  const boxW = colWidthPx - 8;
  const MAX_H = 150;                                   // keep rows workable
  data.forEach((rec, i) => {
    const url = rec[cols[ci].k];
    if (!url) return;
    const m = /^data:image\/(png|jpeg|jpg);base64,(.+)$/i.exec(url);
    if (!m) return;
    /* The true ratio, read from the image's own header. Guessing it — which an
       earlier version did, at a fixed 16:9 — is exactly how a screenshot ends
       up stretched in the report. A picture that cannot be measured is left
       out rather than placed at a made-up shape. */
    const dims = imageSize(url);
    if (!dims || !dims.w || !dims.h) return;
    const scale = Math.min(boxW / dims.w, MAX_H / dims.h);
    const w = Math.round(dims.w * scale);
    const h = Math.round(dims.h * scale);
    const id = wb.addImage({ base64: m[2], extension: m[1] === 'jpg' ? 'jpeg' : m[1] });
    /* Excel row height is in points; a pixel is 0.75pt. */
    ws.getRow(6 + i).height = Math.max(ws.getRow(6 + i).height || 0, h * 0.75 + 8);
    ws.addImage(id, { tl: { col: ci + 0.06, row: 6 + i - 1 + 0.06 }, ext: { width: w, height: h } });
  });
}

/** Sum the custom counters across a set of metric rows. */
function sumExtras(rows) {
  const extra = {};
  for (const m of rows) {
    for (const [k, v] of Object.entries(m.extra || {})) extra[k] = (extra[k] || 0) + num(v);
  }
  return extra;
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
    { h: 'Market', k: 'market', w: 12, opt: true },
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
    { h: 'Note', k: 'note', w: 34, opt: true },
  ],
  linesClient: [
    { h: 'Month', k: 'month', w: 13 },
    { h: 'Campaign', k: 'campaign', w: 28 },
    { h: 'Platform', k: 'platform', w: 12 },
    { h: 'Objective', k: 'objective', w: 14 },
    { h: 'Line', k: 'line', w: 38 },
    { h: 'Market', k: 'market', w: 12, opt: true },
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
    { h: 'Live from', k: 'from', w: 12, opt: true },
    { h: 'Live to', k: 'to', w: 12, opt: true },
    { h: 'Target budget', k: 'target', w: 15, fmt: MONEY },
    { h: 'Spend', k: 'spend', w: 14, fmt: MONEY },
    { h: 'Impressions', k: 'imp', w: 13, fmt: INTF },
    { h: 'Clicks', k: 'clk', w: 11, fmt: INTF },
    { h: 'CTR', k: 'ctr', w: 10, fmt: PCT1 },
    { h: 'Preview', k: 'url', w: 36, opt: true },
    { h: 'Screenshot', k: 'shot', w: 26, opt: true, image: true },
  ],
  activity: [
    { h: 'Date', k: 'date', w: 12 },
    { h: 'Client', k: 'client', w: 20 },
    { h: 'Campaign', k: 'campaign', w: 26 },
    { h: 'Applies to', k: 'scope', w: 30 },
    { h: 'Entry', k: 'body', w: 78 },
    /* Both optional, and both internal-only. The byline names a GMS colleague,
       which is ours to know and not the client's — it is dropped from the
       client report the same way Visibility is. */
    { h: 'Added by', k: 'author', w: 16, opt: true },
    { h: 'Visibility', k: 'vis', w: 15, opt: true },
  ],
  spendlog: [
    { h: 'Date', k: 'date', w: 12 },
    { h: 'Client', k: 'client', w: 20 },
    { h: 'Campaign', k: 'campaign', w: 24 },
    { h: 'Platform', k: 'platform', w: 12 },
    { h: 'Line', k: 'line', w: 30 },
    { h: 'Creative', k: 'creative', w: 24 },
    { h: 'Currency', k: 'ccy', w: 9 },
    /* Each row is the running total as reported on that date, which is what
       the team types. The delta is derived here rather than typed, because a
       reader asking "what did this line do in July" should not have to
       subtract two rows by hand. */
    { h: 'Running total', k: 'sp', w: 15, fmt: MONEY },
    { h: 'Change since previous', k: 'spDelta', w: 20, fmt: MONEY, opt: true },
    { h: 'Impressions (total)', k: 'imp', w: 17, fmt: INTF },
    { h: 'Clicks (total)', k: 'clk', w: 14, fmt: INTF },
    { h: 'Note', k: 'note', w: 30, opt: true },
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

  /* Thumbnails are not part of the boot read, so fetch the ones this export
     will need before building the workbook — otherwise the Creative sheet
     would quietly ship without pictures that do exist. */
  if (cfg.sheets.creative) {
    const ids = [...new Set(rows.flatMap((m) =>
      where('creative', (c) => c.line_id === m.line.id).map((c) => c.id)))];
    if (ids.length) await loadCreativeImages(ids);
  }

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
  if (cfg.sheets.activity !== false) sheetActivity(wb, rows, { isClient, title, subtitle });
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
  const defs = kpiDefs();
  const sumBase = isClient ? COLS.summaryClient : COLS.summaryInternal;
  const cols = [...sumBase, ...kpiColumns(defs, { base: sumBase })];
  layout(ws, { title: `${title} — Summary`, subtitle, cols });

  const pInt = byPlatform(rows, 'internal');
  const pCli = byPlatform(rows, 'client');
  /* byPlatform sums the money; the custom counters are summed here from the
     same rows, so a platform's cost-per divides that platform's own spend by
     that platform's own conversions rather than a global average. */
  const data = pInt.map((p) => {
    const q = pCli.find((x) => x.platform === p.platform) || { spend: 0, budget: 0 };
    const mine = rows.filter((m) => (m.line.platform || '') === (p.platform || ''));
    const agg = { spend: isClient ? q.spend : p.spend, imp: 0, clicks: 0, extra: sumExtras(mine) };
    for (const m of mine) { agg.imp += num(m.imp); agg.clicks += num(m.clicks); }
    return {
      platform: p.platform || '—', lines: p.lines,
      bi: p.budget || null, si: p.spend || null,
      bc: q.budget || null, sc: q.spend || null,
      rem: Math.max(0, q.budget - q.spend) || null,
      gm: (q.spend - p.spend) || null,
      mp: q.spend > 0 ? (q.spend - p.spend) / q.spend : null,
      dl: q.budget > 0 ? q.spend / q.budget : null,
      ...kpiCells(defs, agg),
    };
  });
  const end = writeRows(ws, cols, data);
  const t = totals(rows);
  const grand = {
    spend: isClient ? t.spendClient : t.spendInternal,
    imp: t.imp, clicks: t.clicks, extra: sumExtras(rows),
  };
  const after = totalRow(ws, end, cols, {
    lines: rows.length,
    bi: t.budgetInternal || null, si: t.spendInternal || null,
    bc: t.budgetClient || null, sc: t.spendClient || null,
    rem: Math.max(0, t.budgetClient - t.spendClient) || null,
    gm: (t.spendClient - t.spendInternal) || null,
    mp: t.effMargin,
    dl: t.budgetClient > 0 ? t.spendClient / t.budgetClient : null,
    ...kpiCells(defs, grand),
  }, 'TOTAL');
  finish(ws, after, cols.length);
}

function sheetLines(wb, rows, { isClient, title, subtitle }) {
  const ws = wb.addWorksheet(isClient ? 'Campaign performance' : 'Line detail');

  /* Custom KPI columns ride along on both audiences — counters are the
     tracker's own numbers, and rates recompute here from this row's sums, on
     the side's own spend figure (a client file quotes client cost per
     conversion, not internal). */
  const defs = kpiDefs();
  const lineBase = isClient ? COLS.linesClient : COLS.linesInternal;

  const data = rows.map((m) => ({
    ...kpiCells(defs, {
      spend: isClient ? m.spendClient : m.spendInternal,
      imp: m.imp, clicks: m.clicks, extra: m.extra,
    }),
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
    status: effectiveStatus(m.line, m.campaign), note: m.line.note || '',
  }));
  const cols = pruneEmpty([...lineBase, ...kpiColumns(defs, { base: lineBase })], data);
  layout(ws, { title: `${title} — ${isClient ? 'Performance' : 'Line detail'}`, subtitle, cols });
  finish(ws, writeRows(ws, cols, data), cols.length);
}

function sheetCreative(wb, rows, { isClient, title, subtitle }) {
  const defs = kpiDefs();
  const data = [];
  const seen = new Set();
  const seenLines = new Set();
  const sumRows = (sp) => {
    const extra = {};
    for (const r of sp) for (const [k, v] of Object.entries(r.extra || {})) extra[k] = (extra[k] || 0) + num(v);
    return extra;
  };
  for (const m of rows) {
    /* A split line whose spend predates the split would make this sheet add up
       to less than the same line does everywhere else. The gap gets its own
       row rather than being left for someone to find. */
    if (!seenLines.has(m.line.id)) {
      seenLines.add(m.line.id);
      const crs = where('creative', (x) => x.line_id === m.line.id);
      const loose = crs.length
        ? looseSpendTotal(crs, where('spend', (s) => s.line_id === m.line.id)) / m.rate
        : 0;
      if (loose > 0.005) {
        const known = new Set(crs.map((c) => c.id));
        const looseRows = where('spend', (x) => x.line_id === m.line.id
          && (!x.creative_id || !known.has(x.creative_id)));
        const spendSide = isClient ? grossUp(loose, m.margin) : loose;
        data.push({
          client: m.clientName, campaign: m.campaignName, platform: m.line.platform,
          creative: 'Not attributed to a creative', from: '', to: '', target: null,
          spend: spendSide,
          imp: null, clk: null, ctr: null, url: '',
          ...kpiCells(defs, { spend: spendSide, imp: 0, clicks: 0, extra: sumRows(looseRows) }),
        });
      }
    }
    for (const c of where('creative', (x) => x.line_id === m.line.id)) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      /* Each creative keeps its own running total, so its figure is the
         latest snapshot — and each metric carries forward on its own, so a
         day when only spend was filled in does not zero the counters. */
      const at = cumulative(where('spend', (s) => s.creative_id === c.id));
      const internal = at.spend / m.rate;
      const imp = at.imp;
      const clk = at.clicks;
      const extra = at.extra;
      if (!internal && !imp && !clk && !Object.values(extra).some(Boolean)) continue;
      const spendSide = isClient ? grossUp(internal, m.margin) : internal;
      const targetInternal = num(c.target_budget) / m.rate;
      const targetSide = isClient ? grossUp(targetInternal, m.margin) : targetInternal;
      data.push({
        client: m.clientName, campaign: m.campaignName, platform: m.line.platform,
        creative: c.name || '', from: c.live_from || '', to: c.live_to || '',
        target: targetSide || null,
        spend: spendSide,
        imp: imp || null, clk: clk || null,
        ctr: imp > 0 ? clk / imp : null,
        url: c.preview_url || '',
        /* Marker only — the picture is placed after the rows are written,
           because a floating image is anchored to a cell, not written into
           one. Kept as a value so pruneEmpty can drop the whole column when
           no creative has a screenshot. */
        shot: c.preview_image || '',
        ...kpiCells(defs, { spend: spendSide, imp, clicks: clk, extra }),
      });
    }
  }
  if (!data.length) return;               // no creatives with spend — no sheet
  const ws = wb.addWorksheet('Creative breakdown');
  const base = isClient ? COLS.creative.filter((c) => c.k !== 'client') : COLS.creative;
  const cols = pruneEmpty([...base, ...kpiColumns(defs, { base })], data);
  layout(ws, { title: `${title} — Creative`, subtitle, cols });
  const end = writeRows(ws, cols, data);
  placeThumbnails(ws, wb, cols, data);
  finish(ws, end, cols.length);
}

/**
 * The tracking log as a sheet.
 *
 * The client workbook carries only entries explicitly marked shared — an
 * internal note is free text, and free text is the easiest way to put a margin
 * conversation in front of a client. The Visibility column exists only in the
 * internal file, where the distinction is worth seeing; in a client file every
 * row is shared by definition, so the column prunes itself away.
 */
function sheetActivity(wb, rows, { isClient, title, subtitle }) {
  const campaigns = new Map();
  for (const m of rows) if (m.campaign?.id) campaigns.set(m.campaign.id, m);
  const lineName = (id) => {
    const l = all('line').find((x) => x.id === id);
    return l ? (l.placement || l.supplier || l.platform || 'line') : 'line';
  };

  const data = [];
  for (const [cid, m] of campaigns) {
    for (const n of campaignLog(cid, { sharedOnly: isClient })) {
      data.push({
        date: n.date || '', client: m.clientName, campaign: m.campaignName,
        scope: n.line_id ? lineName(n.line_id) : 'Whole campaign',
        body: n.body || '',
        author: isClient ? '' : (n.author || ''),
        vis: isClient ? '' : (n.shared ? 'Shared with client' : 'Internal only'),
      });
    }
  }
  if (!data.length) return;                    // nothing logged — no sheet
  data.sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const ws = wb.addWorksheet('Tracking log');
  const cols = pruneEmpty(isClient ? COLS.activity.filter((c) => c.k !== 'client') : COLS.activity, data);
  layout(ws, { title: `${title} — Tracking log`, subtitle, cols });
  finish(ws, writeRows(ws, cols, data), cols.length);
}

function sheetSpendLog(wb, rows, { title, subtitle }) {
  const defs = kpiDefs();
  const seen = new Set();
  const data = [];
  for (const m of rows) {
    /* Per bucket, in date order, so "change since previous" compares a
       creative with itself rather than with whatever row happened to precede
       it in the table. */
    const buckets = new Map();
    for (const s of where('spend', (x) => x.line_id === m.line.id)) {
      const k = s.creative_id || '';
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(s);
    }
    for (const bucket of buckets.values()) {
      bucket.sort((a, b) => String(a.date).localeCompare(String(b.date)));
      let previous = null;
      for (const s of bucket) {
        const running = num(s.spend_internal);
        const delta = previous == null ? null : Math.round((running - previous) * 100) / 100;
        if (s.spend_internal != null && s.spend_internal !== '') previous = running;
        if (seen.has(s.id)) continue;
        seen.add(s.id);
        data.push({
          date: s.date, client: m.clientName, campaign: m.campaignName,
          platform: m.line.platform,
          line: m.line.placement || m.line.supplier || '',
          creative: s.creative_id ? (byId('creative', s.creative_id)?.name || '') : '',
          ccy: m.ccy, sp: running || null, spDelta: delta,
          imp: num(s.imp) || null, clk: num(s.clicks) || null, note: s.note || '',
          ...kpiCells(defs, { spend: 0, imp: 0, clicks: 0, extra: s.extra || {} }, { ratesToo: false }),
        });
      }
    }
  }
  data.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  /* Columns are settled after the data exists, so an all-blank optional one
     can be left out rather than shipped empty. */
  const ws = wb.addWorksheet('Spend log');
  /* Counters only: this sheet is every daily entry exactly as typed, and a
     rate is a property of a set of rows rather than of one day. */
  const cols = pruneEmpty(
    [...COLS.spendlog, ...kpiColumns(defs, { ratesToo: false, base: COLS.spendlog })], data);
  layout(ws, { title: `${title} — Spend log`, subtitle, cols });
  finish(ws, writeRows(ws, cols, data), cols.length);
}

/* ---------------------------------------------------------------- backup */

export function exportBackup() {
  const data = Object.fromEntries(['client', 'campaign', 'line', 'line_month',
    'creative', 'spend', 'vocab', 'fx', 'settings'].map((t) => [t, all(t)]));
  download(`tracking-backup-${stamp()}.json`,
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
}
