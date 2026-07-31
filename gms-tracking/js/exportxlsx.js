/* Excel export — two workbooks from one dataset.

   INTERNAL  keeps everything: media cost, margin %, internal rates.
   EXTERNAL  is the client report. Margin, internal cost, internal rates and
             non-billable lines are not written into the file at all — not
             hidden columns, not white text. They are never added.           */

import { download, toast } from './dom.js';
import { all, where, byId } from './store.js';
import { totals, byPlatform, num } from './calc.js';
import { monthLabel } from './dom.js';

const ORANGE = 'FFEA6A1E';
const CHARCOAL = 'FF211F1C';
const GREY = 'FF8C877E';

const ensureExcel = () => window.__loadExcel();

const stamp = () => new Date().toISOString().slice(0, 10);

/* --------------------------------------------------------------- helpers */

function titleBlock(ws, { title, sub, kind, span }) {
  ws.mergeCells(1, 1, 1, span);
  const t = ws.getCell(1, 1);
  t.value = { richText: [
    { text: 'GMS ', font: { bold: true, size: 15, color: { argb: ORANGE }, name: 'Calibri' } },
    { text: title, font: { bold: true, size: 15, color: { argb: CHARCOAL }, name: 'Calibri' } },
  ] };
  ws.getRow(1).height = 22;

  ws.mergeCells(2, 1, 2, span);
  ws.getCell(2, 1).value = sub;
  ws.getCell(2, 1).font = { size: 9.5, color: { argb: GREY } };

  ws.mergeCells(3, 1, 3, span);
  ws.getCell(3, 1).value = kind;
  ws.getCell(3, 1).font = { size: 9, bold: true, color: { argb: ORANGE } };
  ws.getRow(3).border = { bottom: { style: 'medium', color: { argb: ORANGE } } };
  ws.getRow(4).height = 6;
}

function headerRow(ws, rowIdx, cols) {
  const r = ws.getRow(rowIdx);
  r.values = cols.map((c) => c.h);
  r.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CHARCOAL } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
  r.height = 28;
  ws.columns = cols.map((c) => ({ width: c.w || 14 }));
  ws.views = [{ state: 'frozen', ySplit: rowIdx }];
  ws.autoFilter = { from: { row: rowIdx, column: 1 }, to: { row: rowIdx, column: cols.length } };
}

function writeRows(ws, startRow, cols, data) {
  data.forEach((rec, i) => {
    const r = ws.getRow(startRow + i);
    cols.forEach((c, j) => {
      const cell = r.getCell(j + 1);
      cell.value = rec[c.k] ?? null;
      if (c.fmt) cell.numFmt = c.fmt;
      if (c.k === 'note' || c.w > 26) cell.alignment = { wrapText: true, vertical: 'top' };
    });
  });
  return startRow + data.length;
}

function totalRow(ws, rowIdx, cols, rec, label) {
  const r = ws.getRow(rowIdx);
  cols.forEach((c, j) => {
    const cell = r.getCell(j + 1);
    cell.value = j === 0 ? label : (rec[c.k] ?? null);
    if (c.fmt && j > 0) cell.numFmt = c.fmt;
    cell.font = { bold: true };
    cell.border = { top: { style: 'thin', color: { argb: CHARCOAL } } };
  });
}

const MONEY = '#,##0.00;[Red]-#,##0.00';
const MONEY0 = '#,##0;[Red]-#,##0';
const PCT = '0.0%';

/* -------------------------------------------------------------- internal */

export async function exportInternal(rows, state) {
  await ensureExcel();
  const wb = new window.ExcelJS.Workbook();
  wb.creator = 'GMS Digital — Tracking Dashboard';
  const period = monthLabel(state.ym);
  const sub = `${period} · exported ${stamp()} · all figures AUD unless stated`;

  /* --- Summary */
  const ws1 = wb.addWorksheet('Summary');
  const c1 = [
    { h: 'Platform', k: 'platform', w: 16 },
    { h: 'Lines', k: 'lines', w: 8 },
    { h: 'Budget — internal', k: 'bi', w: 17, fmt: MONEY0 },
    { h: 'Spend — internal', k: 'si', w: 17, fmt: MONEY },
    { h: 'Budget — client', k: 'bc', w: 17, fmt: MONEY0 },
    { h: 'Spend — client', k: 'sc', w: 17, fmt: MONEY },
    { h: 'Gross margin', k: 'gm', w: 15, fmt: MONEY },
    { h: 'Margin %', k: 'mp', w: 11, fmt: PCT },
    { h: 'Delivery', k: 'dl', w: 11, fmt: PCT },
  ];
  titleBlock(ws1, { title: 'Tracking — Summary', sub, kind: 'INTERNAL · contains margin', span: c1.length });
  headerRow(ws1, 5, c1);

  const pInt = byPlatform(rows, 'internal');
  const pCli = byPlatform(rows, 'client');
  const sumRows = pInt.map((p) => {
    const q = pCli.find((x) => x.platform === p.platform) || { spend: 0, budget: 0 };
    return {
      platform: p.platform || '—', lines: p.lines,
      bi: p.budget, si: p.spend, bc: q.budget, sc: q.spend,
      gm: q.spend - p.spend,
      mp: q.spend > 0 ? (q.spend - p.spend) / q.spend : null,
      dl: q.budget > 0 ? q.spend / q.budget : null,
    };
  });
  const end1 = writeRows(ws1, 6, c1, sumRows);
  const t = totals(rows);
  totalRow(ws1, end1, c1, {
    lines: rows.length, bi: t.budgetInternal, si: t.spendInternal,
    bc: t.budgetClient, sc: t.spendClient, gm: t.spendClient - t.spendInternal,
    mp: t.effMargin, dl: t.budgetClient > 0 ? t.spendClient / t.budgetClient : null,
  }, 'TOTAL');

  /* --- Tracking */
  const ws2 = wb.addWorksheet('Tracking');
  const c2 = [
    { h: 'Client', k: 'client', w: 18 },
    { h: 'Campaign', k: 'campaign', w: 26 },
    { h: 'IO number', k: 'io', w: 22 },
    { h: 'Platform', k: 'platform', w: 12 },
    { h: 'Objective', k: 'objective', w: 15 },
    { h: 'Line', k: 'line', w: 30 },
    { h: 'Market', k: 'market', w: 12 },
    { h: 'Buy method', k: 'buy', w: 11 },
    { h: 'Budget internal (AUD)', k: 'bi', w: 18, fmt: MONEY0 },
    { h: 'Budget internal (local)', k: 'bl', w: 18, fmt: MONEY0 },
    { h: 'Currency', k: 'ccy', w: 9 },
    { h: 'Spend internal (local)', k: 'sl', w: 18, fmt: MONEY },
    { h: 'Spend internal (AUD)', k: 'si', w: 18, fmt: MONEY },
    { h: 'Margin %', k: 'mp', w: 10, fmt: PCT },
    { h: 'Budget client', k: 'bc', w: 15, fmt: MONEY0 },
    { h: 'Client spend — pro-rata', k: 'cp', w: 19, fmt: MONEY },
    { h: 'Client spend — capped', k: 'cc', w: 19, fmt: MONEY },
    { h: 'Over booked budget', k: 'ov', w: 17, fmt: MONEY },
    { h: 'Margin realised', k: 'me', w: 14, fmt: PCT },
    { h: 'Impressions', k: 'imp', w: 13, fmt: MONEY0 },
    { h: 'Clicks', k: 'clk', w: 11, fmt: MONEY0 },
    { h: 'Booked rate — media', k: 'brm', w: 16, fmt: MONEY },
    { h: 'Booked rate — GMS', k: 'brg', w: 16, fmt: MONEY },
    { h: 'Actual rate — internal', k: 'ari', w: 17, fmt: MONEY },
    { h: 'Actual rate — client', k: 'arc', w: 17, fmt: MONEY },
    { h: 'Rate index', k: 'ri', w: 11, fmt: PCT },
    { h: 'Suggested daily', k: 'sd', w: 14, fmt: MONEY0 },
    { h: 'Pacing', k: 'pc', w: 10, fmt: PCT },
    { h: 'Pacing index', k: 'pi', w: 12, fmt: PCT },
    { h: 'Billable', k: 'nb', w: 10 },
    { h: 'Status', k: 'status', w: 12 },
    { h: 'Note', k: 'note', w: 34 },
  ];
  titleBlock(ws2, { title: 'Tracking — Line detail', sub, kind: 'INTERNAL · contains margin', span: c2.length });
  headerRow(ws2, 5, c2);
  writeRows(ws2, 6, c2, rows.map((m) => ({
    client: m.clientName, campaign: m.campaignName, io: m.campaign.io_number || '',
    platform: m.line.platform, objective: m.line.objective,
    line: m.line.placement || m.line.supplier || '', market: m.line.market || '',
    buy: m.line.buy_method || '',
    bi: m.budgetInternal || null, bl: m.budgetCcy || null, ccy: m.ccy,
    sl: m.spendCcy || null, si: m.spendInternal || null,
    mp: m.margin || null, bc: m.budgetClient || null,
    cp: m.clientProrata || null, cc: m.spendClient || null, ov: m.overspend || null,
    me: m.effMargin, imp: m.imp || null, clk: m.clicks || null,
    brm: m.line.rate_media, brg: m.line.rate_gms,
    ari: m.internal.actualRate, arc: m.client.actualRate, ri: m.internal.rateIndex,
    sd: m.internal.suggestedDaily || null,
    pc: m.internal.pacingPct, pi: m.internal.pacingIndex,
    nb: m.billable ? 'Yes' : 'No', status: m.line.status || '', note: m.line.note || '',
  })));

  /* --- Spend log */
  const ws3 = wb.addWorksheet('Spend log');
  const c3 = [
    { h: 'Date', k: 'date', w: 12 }, { h: 'Client', k: 'client', w: 18 },
    { h: 'Campaign', k: 'campaign', w: 24 }, { h: 'Platform', k: 'platform', w: 12 },
    { h: 'Line', k: 'line', w: 28 }, { h: 'Creative', k: 'creative', w: 22 },
    { h: 'Currency', k: 'ccy', w: 9 },
    { h: 'Spend internal', k: 'sp', w: 15, fmt: MONEY },
    { h: 'Impressions', k: 'imp', w: 13, fmt: MONEY0 },
    { h: 'Clicks', k: 'clk', w: 11, fmt: MONEY0 },
    { h: 'Note', k: 'note', w: 30 },
  ];
  titleBlock(ws3, { title: 'Tracking — Spend log', sub, kind: 'INTERNAL', span: c3.length });
  headerRow(ws3, 5, c3);
  writeRows(ws3, 6, c3, spendLog(rows));

  await save(wb, `GMS Tracking — INTERNAL — ${period} — ${stamp()}.xlsx`);
}

/* -------------------------------------------------------------- external */

export async function exportExternal(rows, state) {
  await ensureExcel();
  const billable = rows.filter((m) => m.billable);
  if (!billable.length) { toast('Nothing billable in this period to report', 'bad'); return; }

  const wb = new window.ExcelJS.Workbook();
  wb.creator = 'Global Media Solutions';
  const period = monthLabel(state.ym);
  const sub = `${period} · issued ${stamp()} · all figures AUD`;

  /* --- Summary. Client-facing budget and spend only. */
  const ws1 = wb.addWorksheet('Summary');
  const c1 = [
    { h: 'Platform', k: 'platform', w: 18 },
    { h: 'Campaigns', k: 'lines', w: 11 },
    { h: 'Budget', k: 'budget', w: 15, fmt: MONEY0 },
    { h: 'Spend', k: 'spend', w: 15, fmt: MONEY },
    { h: 'Remaining', k: 'rem', w: 15, fmt: MONEY },
    { h: 'Delivery', k: 'dl', w: 11, fmt: PCT },
  ];
  titleBlock(ws1, { title: 'Campaign Report — Summary', sub, kind: 'Prepared for the client', span: c1.length });
  headerRow(ws1, 5, c1);

  const plats = byPlatform(billable, 'client');
  const end1 = writeRows(ws1, 6, c1, plats.map((p) => ({
    platform: p.platform || '—', lines: p.lines, budget: p.budget, spend: p.spend,
    rem: Math.max(0, p.budget - p.spend), dl: p.pacingPct,
  })));
  const t = totals(billable);
  totalRow(ws1, end1, c1, {
    lines: billable.length, budget: t.budgetClient, spend: t.spendClient,
    rem: Math.max(0, t.budgetClient - t.spendClient),
    dl: t.budgetClient > 0 ? t.spendClient / t.budgetClient : null,
  }, 'TOTAL');

  /* --- Performance */
  const ws2 = wb.addWorksheet('Campaign performance');
  const c2 = [
    { h: 'Client', k: 'client', w: 18 },
    { h: 'Campaign', k: 'campaign', w: 26 },
    { h: 'Platform', k: 'platform', w: 12 },
    { h: 'Objective', k: 'objective', w: 15 },
    { h: 'Line', k: 'line', w: 30 },
    { h: 'Market', k: 'market', w: 12 },
    { h: 'Flight', k: 'flight', w: 22 },
    { h: 'Buy method', k: 'buy', w: 11 },
    { h: 'Budget', k: 'budget', w: 14, fmt: MONEY0 },
    { h: 'Spend', k: 'spend', w: 14, fmt: MONEY },
    { h: 'Delivery', k: 'dl', w: 10, fmt: PCT },
    { h: 'Impressions', k: 'imp', w: 13, fmt: MONEY0 },
    { h: 'Clicks', k: 'clk', w: 11, fmt: MONEY0 },
    { h: 'Booked rate', k: 'br', w: 13, fmt: MONEY },
    { h: 'Delivered rate', k: 'ar', w: 14, fmt: MONEY },
    { h: 'vs booked', k: 'ri', w: 11, fmt: PCT },
    { h: 'Status', k: 'status', w: 12 },
  ];
  titleBlock(ws2, { title: 'Campaign Report — Performance', sub, kind: 'Prepared for the client', span: c2.length });
  headerRow(ws2, 5, c2);
  writeRows(ws2, 6, c2, billable.map((m) => ({
    client: m.clientName, campaign: m.campaignName,
    platform: m.line.platform, objective: m.line.objective,
    line: m.line.placement || m.line.supplier || '', market: m.line.market || '',
    flight: m.flight ? `${m.flight.start} – ${m.flight.end}` : '',
    buy: m.line.buy_method || '',
    budget: m.budgetClient || null, spend: m.spendClient || null,
    dl: m.client.pacingPct, imp: m.imp || null, clk: m.clicks || null,
    br: m.line.rate_gms, ar: m.client.actualRate, ri: m.client.rateIndex,
    status: m.line.status || '',
  })));

  /* --- Creative breakdown, only when there is one. */
  const crRows = creativeRows(billable);
  if (crRows.length) {
    const ws3 = wb.addWorksheet('Creative breakdown');
    const c3 = [
      { h: 'Client', k: 'client', w: 18 }, { h: 'Campaign', k: 'campaign', w: 24 },
      { h: 'Platform', k: 'platform', w: 12 }, { h: 'Creative', k: 'creative', w: 30 },
      { h: 'Live from', k: 'from', w: 12 },
      { h: 'Spend', k: 'spend', w: 14, fmt: MONEY },
      { h: 'Impressions', k: 'imp', w: 13, fmt: MONEY0 },
      { h: 'Clicks', k: 'clk', w: 11, fmt: MONEY0 },
      { h: 'CTR', k: 'ctr', w: 10, fmt: PCT },
      { h: 'Preview', k: 'url', w: 34 },
    ];
    titleBlock(ws3, { title: 'Campaign Report — Creative', sub, kind: 'Prepared for the client', span: c3.length });
    headerRow(ws3, 5, c3);
    writeRows(ws3, 6, c3, crRows);
  }

  await save(wb, `GMS Campaign Report — ${period} — ${stamp()}.xlsx`);
}

/* ----------------------------------------------------------------- parts */

function spendLog(rows) {
  const out = [];
  for (const m of rows) {
    for (const s of where('spend', (x) => x.line_id === m.line.id)) {
      if (m.flight && (s.date < m.flight.start || s.date > m.flight.end)) {
        // still export it — the log is the raw record, not a filtered view
      }
      out.push({
        date: s.date, client: m.clientName, campaign: m.campaignName,
        platform: m.line.platform,
        line: m.line.placement || m.line.supplier || '',
        creative: s.creative_id ? (byId('creative', s.creative_id)?.name || '') : '',
        ccy: m.ccy, sp: num(s.spend_internal) || null,
        imp: num(s.imp) || null, clk: num(s.clicks) || null, note: s.note || '',
      });
    }
  }
  return out.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}

function creativeRows(rows) {
  const out = [];
  for (const m of rows) {
    for (const c of where('creative', (x) => x.line_id === m.line.id)) {
      const sp = where('spend', (s) => s.creative_id === c.id);
      const internal = sp.reduce((a, s) => a + num(s.spend_internal), 0) / m.rate;
      const imp = sp.reduce((a, s) => a + num(s.imp), 0);
      const clk = sp.reduce((a, s) => a + num(s.clicks), 0);
      out.push({
        client: m.clientName, campaign: m.campaignName, platform: m.line.platform,
        creative: c.name || '', from: c.live_from || '',
        spend: internal ? internal / (1 - (m.margin || 0)) : null,
        imp: imp || null, clk: clk || null,
        ctr: imp > 0 ? clk / imp : null,
        url: c.preview_url || '',
      });
    }
  }
  return out;
}

async function save(wb, name) {
  const buf = await wb.xlsx.writeBuffer();
  download(name, new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }));
  toast(`Exported ${name}`);
}

export function exportBackup() {
  const data = Object.fromEntries(['client', 'campaign', 'line', 'line_month',
    'creative', 'spend', 'vocab', 'fx', 'settings'].map((t) => [t, all(t)]));
  download(`tracking-backup-${stamp()}.json`,
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
}
