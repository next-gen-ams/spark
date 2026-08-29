/* Tracking Entry — where the actuals get typed in.
 *
 * Built around how the team actually works: a couple of times a week someone
 * opens the media console and copies the day's numbers across. So the default
 * is TODAY, it saves as you type, and every row shows what that entry did to
 * the line's pacing.
 *
 * The pacing figures come from calc.repace(), which treats the plan's monthly
 * split as a schedule rather than as separate budgets. An underspent month is
 * still owed to the campaign, so the figure to aim at is always "everything
 * not yet spent ÷ days still left in the flight" — which carries a shortfall
 * forward instead of quietly losing it at month end.
 */

import { el, fill, money, money2, int, pct, monthLabel, dateAu, toast, shown, tip } from './dom.js';
import { put, remove, where, byId, newId, fxMap, loadCreativeImages, deleteCreative } from './store.js';
import { dialog, confirmDanger, closeDialog, textField, choiceField, errorLine } from './modal.js';
import { imageField } from './paste-image.js';
import { openLog, noteCount } from './notes.js';
import { monthBounds, grossUp, repace, todayIso, daySplit, looseSpendTotal, periodSpend,
  cumulative, creativeActive, creativePace, kpiValue, spendForSide, deliveryPct,
  effectiveStatus } from './calc.js';
import { kpiDefs, addKpi, removeKpi, PRESETS, hasPreset, companionsFor, kpiFormula, formatKpi } from './kpis.js';
import { resizable, forgetWidths } from './resizable.js';
import { PLATFORM_COLOR } from './config.js';
import { exportBackup } from './exportxlsx.js';

const spendId = (lineId, creativeId, date) => `${lineId}|${creativeId || '_'}|${date}`;
const ENTRY_COLUMNS_KEY = 'gms-tracking-entry-columns-v1';
const isCtr = (def) => def?.id === 'ctr' || String(def?.name || '').trim().toLowerCase() === 'ctr';
let creativeImageLoad = null;

function entryColumns() {
  try {
    return { impressions: false, clicks: false, ctr: false, internalAud: false, clientAud: false,
      ...JSON.parse(localStorage.getItem(ENTRY_COLUMNS_KEY) || '{}') };
  } catch {
    return { impressions: false, clicks: false, ctr: false, internalAud: false, clientAud: false };
  }
}

function saveEntryColumns(value) {
  try { localStorage.setItem(ENTRY_COLUMNS_KEY, JSON.stringify(value)); } catch { /* preference only */ }
}

function entryWidthKey() {
  const defs = kpiDefs();
  const counters = defs.filter((d) => d.kind === 'counter').length;
  const rates = defs.length - counters;
  const cols = entryColumns();
  return `tracking-entry6-${counters}c${rates}r-${cols.impressions ? 'm' : ''}${cols.clicks ? 'k' : ''}${cols.ctr ? 't' : ''}${cols.internalAud ? 'i' : ''}${cols.clientAud ? 'c' : ''}`;
}

export function renderSpend(host, ctx) {
  const { rows, state, rerender } = ctx;

  if (!rows.length) {
    host.appendChild(el('div', { class: 'panel' }, el('div', { class: 'empty' },
      el('strong', {}, 'Nothing to track in this period'),
      el('div', {}, 'Add a campaign, or clear the filters.'))));
    return;
  }

  const today = todayIso();
  const mode = state.spendMode === 'day' ? 'day' : 'today';
  const bounds = state.ym ? monthBounds(state.ym) : null;

  let date = today;
  if (mode === 'day') {
    date = state.spendDate || today;
    if (bounds && (date < bounds.start || date > bounds.end)) date = bounds.end;
    /* Actuals only. "Another day" exists to fill a day that was missed, and a
       day that has not happened cannot have been missed. */
    if (date > today) date = today;
  }

  /* The boot query deliberately leaves artwork out because screenshots are
     comparatively large. Fetch every visible creative in one request and
     repaint once. Loading one image per row used to cause one full-page
     rebuild per creative immediately after refresh, which made the Columns
     button and ordinary page scrolling feel as though they were dragging. */
  primeCreativeImages(rows, date, rerender);

  host.appendChild(el('div', { class: 'panel' },
    el('header', { class: 'entryhead' },
      el('h3', {}, mode === 'today' ? `Today’s numbers · ${dateAu(today)}` : 'Enter internal spend',
        tip('Enter each platform cumulative total. For a creative split, update the creative rows and the Line Total calculates automatically.')),
      el('div', { class: 'entrytools' },
        el('div', { class: 'seg' },
          segBtn('today', 'Today', mode, state, rerender),
          segBtn('day', 'Another day', mode, state, rerender)),
        mode === 'day' ? el('input', {
          type: 'date', class: 'pill-sel', value: date,
          min: bounds ? bounds.start : null,
          max: bounds && bounds.end < today ? bounds.end : today,
          onchange: (e) => { state.spendDate = e.target.value; rerender(); },
        }) : null,
        el('button', {
          class: 'btn chip managecolumns', style: { marginTop: 0 },
          'aria-label': 'Manage visible columns and custom metrics',
          onclick: () => manageColumnsDialog(rerender),
        }, 'Manage columns'),
        el('button', {
          class: 'btn ghost sm', 'aria-label': 'Put every column back to its default width',
          onclick: () => { forgetWidths(entryWidthKey()); rerender(); },
        }, 'Reset columns'))),
    el('div', { class: 'tablewrap' }, grid(rows, date, mode, state, rerender))));
}

function primeCreativeImages(rows, date, rerender) {
  if (creativeImageLoad) return;
  const ids = rows.flatMap((m) => where('creative', (c) => c.line_id === m.line.id
    && c.preview_image === undefined && creativeActive(c, m.campaign, date)).map((c) => c.id));
  if (!ids.length) return;
  creativeImageLoad = loadCreativeImages(ids)
    .then((changed) => { if (changed) rerender(); })
    .finally(() => { creativeImageLoad = null; });
}

function segBtn(id, label, mode, state, rerender) {
  return el('button', {
    'aria-pressed': mode === id,
    onclick: () => { state.spendMode = id; rerender(); },
  }, label);
}

function manageColumnsDialog(rerender) {
  const current = entryColumns();
  const impressions = el('input', { type: 'checkbox', checked: current.impressions });
  const clicks = el('input', { type: 'checkbox', checked: current.clicks });
  const ctr = el('input', { type: 'checkbox', checked: current.ctr });
  const internal = el('input', { type: 'checkbox', checked: current.internalAud });
  const client = el('input', { type: 'checkbox', checked: current.clientAud });
  dialog({
    title: 'Manage Tracking Entry columns',
    sub: 'Optional columns are hidden by default so Actions stays within easier reach. This changes only this browser’s table, never the data or exports.',
    content: [
      el('label', { class: 'choice' }, impressions,
        el('span', {}, el('b', {}, 'Impressions'), tip('Show the cumulative impression entry column.'))),
      el('label', { class: 'choice' }, clicks,
        el('span', {}, el('b', {}, 'Clicks'), tip('Show the cumulative click entry column.'))),
      el('label', { class: 'choice' }, ctr,
        el('span', {}, el('b', {}, 'CTR'), tip('Show CTR when that metric has been added.'))),
      el('label', { class: 'choice' }, internal,
        el('span', {}, el('b', {}, 'Internal AUD'), tip('Spend converted from the platform currency to AUD.'))),
      el('label', { class: 'choice' }, client,
        el('span', {}, el('b', {}, 'Client AUD'), tip('Internal AUD grossed up at the line margin.'))),
      el('button', {
        class: 'btn sm', style: { marginTop: '4px' },
        onclick: () => { closeDialog(); addColumnDialog(rerender); },
      }, '+ Add or remove custom metrics'),
    ],
    actions: [
      { label: 'Cancel' },
      { label: 'Apply', primary: true, onClick: () => {
        saveEntryColumns({
          impressions: impressions.checked, clicks: clicks.checked, ctr: ctr.checked,
          internalAud: internal.checked, clientAud: client.checked,
        });
        rerender();
      } },
    ],
  });
}

/* ------------------------------------------------------------------ grid */

function grid(rows, date, mode, state, rerender) {
  const fx = fxMap();
  const today = todayIso();
  const side = state.view;
  const audColumns = entryColumns();
  /* Typed columns first, computed after — mirroring the header's two blocks:
     everything you enter sits together, everything the app derives follows. */
  const all_ = kpiDefs();
  const counters = all_.filter((d) => d.kind === 'counter');
  const ratesK = all_.filter((d) => d.kind !== 'counter');
  const visibleRatesK = ratesK.filter((d) => !isCtr(d) || audColumns.ctr);
  const defs = [...counters, ...ratesK];

  const body = el('tbody');
  for (const m of rows) {
    const creatives = where('creative', (c) => c.line_id === m.line.id);
    const spends = where('spend', (x) => x.line_id === m.line.id);
    const day = daySplit(creatives, spends, date);
    const activeParts = day.parts.filter((p) => creativeActive(p.creative, m.campaign, date));

    /* Pacing belongs to the whole line, so it reads every month and every
       spend row — not the single cell being typed into. It is also computed
       once per line, not once per creative: three creatives do not mean three
       different pacing positions. */
    const r = repace(m.line, m.campaign,
      where('line_month', (x) => x.line_id === m.line.id), spends,
      { fx, today, side });
    const status = effectiveStatus(m.line, m.campaign, today);
    const advice = localPaceAdvice(r, m, status);
    const held = status === 'Paused' || status === 'Stopped'
      || (status === 'Completed' && !r?.finished);

    const write = (creativeId, patch) => {
      put('spend', {
        id: spendId(m.line.id, creativeId, date),
        line_id: m.line.id, creative_id: creativeId || null, date, ...patch,
      });
      rerender();
    };
    /* extra is one object on the spend row; a per-column write must merge into
       whatever the other columns already put there, or it would erase them. */
    const writeExtra = (creativeId, defId, v) => {
      const existing = byId('spend', spendId(m.line.id, creativeId, date));
      write(creativeId, { extra: { ...(existing?.extra || {}), [defId]: v } });
    };
    /* Rates follow the Internal ⇄ Client-facing toggle: same counters, the
       money side the viewer chose. spendForSide returns null for a
       non-billable line on the client side, which kpiValue turns into "—". */
    const lineTotals = () => ({
      spend: spendForSide(day.total.spend / m.rate, side, m.margin, m.billable),
      imp: day.total.imp, clicks: day.total.clicks, extra: day.total.extra,
    });

    /* ---- the line's own row. Editable only while nothing is split off it. */
    body.appendChild(el('tr', { class: m.billable ? '' : 'nb' },
      el('td', { class: 'wrap clientcell' }, el('b', {}, m.clientName)),
      el('td', { class: 'wrap linecell' },
        platformTag(m.line.platform),
        m.line.objective ? el('span', { class: 'lineobjective' }, m.line.objective) : null,
        statusControl(m, status, state, rerender),
        el('div', { class: 'linename' }, lineLabel(m)),
        el('div', { class: 'muted linecampaign' }, m.campaignName),
        lineControls(m, creatives, spends, date, rerender)),

      el('td', { class: 'num' },
        day.split
          ? el('div', { class: 'derived' }, money2(day.total.spend, m.ccy),
            tip(`Sum of ${day.parts.length} creative${day.parts.length === 1 ? '' : 's'} below. Type into those, not here.`, 'Calculated line total'))
          : el('input', {
            class: 'cellinput', type: 'number', step: '0.01',
            value: day.loose.typed ? day.loose.typed.spend : '',
            placeholder: day.loose.at ? '' : '0',
            'aria-label': `Running total for ${lineLabel(m)}`,
            'data-focus': `${m.line.id}|_|s`,
            onchange: (e) => confirmRise(e.target, day.loose, m,
              (v) => write(null, { spend_internal: v })),
          }),
        flightNote(m, r, day, activeParts.length),
        carriedNote(day.loose, m, date)),

      /* --- the rest of the typed block: what you enter sits together. */
      audColumns.impressions ? countCell(day.split, day.total.imp, day.loose.typed?.imp ?? null,
        'Impressions', (v) => write(null, { imp: v }), `${m.line.id}|_|i`) : null,
      audColumns.clicks ? countCell(day.split, day.total.clicks, day.loose.typed?.clicks ?? null,
        'Clicks', (v) => write(null, { clicks: v }), `${m.line.id}|_|c`) : null,
      ...counters.map((d) =>
        countCell(day.split, day.total.extra[d.id], day.loose.typed?.extra?.[d.id] ?? null,
          d.name, (v) => writeExtra(null, d.id, v), `${m.line.id}|_|${d.id}`)),

      /* --- the computed block: the margin doing something, then the rates. */
      audColumns.internalAud ? el('td', { class: 'num muted' }, money(day.total.spend / m.rate)) : null,
      audColumns.clientAud ? el('td', { class: 'num' }, m.billable
        ? el('b', {}, money(grossUp(day.total.spend / m.rate, m.margin)))
        : el('span', { class: 'muted' }, 'n/a')) : null,
      ...visibleRatesK.map((d) => rateCell(d, lineTotals())),

      /* --- running position across the whole flight --- */
      el('td', { class: 'num' }, r ? money(r.spent) : '—',
        r ? el('div', { class: 'muted deliverypct' },
          `of ${money(r.total)} · ${pct(deliveryPct(r), 1)} delivery`,
          tip(mode === 'day'
            ? `Current delivery as at ${dateAu(today)}. Backfilling ${dateAu(date)} changes history; the execution position stays current.`
            : `Current spend divided by the whole-flight booked budget as at ${dateAu(today)}.`, 'Delivery definition')) : null),
      el('td', { class: 'num muted' }, r ? money(r.due) : '—'),
      el('td', { class: 'num' }, r ? varianceCell(r) : '—'),
      el('td', { class: 'num' }, r && !r.finished && !held
        ? el('div', {}, el('b', {}, `${money2(r.localSuggestedDaily, m.ccy)} / day`),
          el('div', { class: 'muted', style: { fontSize: '11px' } },
            `${money2(r.localToMonthTarget, m.ccy)} to month target`),
          el('div', { class: 'muted', style: { fontSize: '11px' } },
            `${r.monthDaysLeft} day${r.monthDaysLeft === 1 ? '' : 's'} left this month`))
        : el('span', { class: 'muted' }, held ? status.toLowerCase() : '—')),
      el('td', { class: 'wrap prose pacecell' }, advice
        ? el('div', {},
          el('span', { class: 'advice ' + (advice.kind === 'ok' ? 'good' : advice.kind) }, advice.text),
          el('div', { class: 'pacebudget muted' },
            `This Month ${money2(r.localMonthBudget, m.ccy)} · Accumulated booking budget ${money2(r.localMonthTarget, m.ccy)}`))
        : el('span', { class: 'muted' }, 'no flight dates')),

      el('td', { class: 'num' }, m.billable
        ? el('span', { class: 'tag' + (m.margin > 0 ? '' : ' crit') },
          m.margin > 0 ? pct(m.margin, 1) : 'not set',
          tip(m.margin > 0
            ? `Client = internal ÷ FX ÷ (1 − ${(m.margin * 100).toFixed(1)}%)`
            : 'No margin on this line — set it in the line drawer.', 'Margin calculation'))
        : el('span', { class: 'muted' }, '—')),
      el('td', { class: 'cractions' }, '')));

    /* ---- one row per creative, and one for anything attributed to none. */
    if (!day.split) continue;
    for (const p of activeParts) {
      const creativeSpends = spends.filter((s) => s.creative_id === p.creative.id);
      body.appendChild(creativeRow(m, p.creative.name || 'Creative', p, {
        side, counters, rates: visibleRatesK, audColumns,
        focusBase: `${m.line.id}|${p.creative.id}`,
        creative: p.creative, refresh: rerender, date,
        pace: creativePace(p.creative, creativeSpends, date, m.campaign),
        onEdit: () => editCreativeDialog(m, p.creative, rerender),
        onDelete: () => deleteCreativeDialog(m, p.creative, creativeSpends, rerender),
        onSpend: (v) => write(p.creative.id, { spend_internal: v }),
        onImp: (v) => write(p.creative.id, { imp: v }),
        onClicks: (v) => write(p.creative.id, { clicks: v }),
        onExtra: (defId, v) => writeExtra(p.creative.id, defId, v),
      }));
    }
    if (day.loose.spend || day.loose.imp || day.loose.clicks
      || Object.values(day.loose.extra).some(Boolean)) {
      body.appendChild(creativeRow(m, 'Not attributed to a creative', day.loose, {
        date,
        side, counters, rates: visibleRatesK, audColumns, readonly: true,
        note: 'Typed before this line was split. It still counts toward the line total — '
          + 'move it onto a creative from the line drawer if it belongs to one.',
      }));
    }
  }

  /* Three header tints, one per block: warm for what you type, blue for what
     the app computes, neutral for the flight position. The colour carries the
     grouping so the eye does not have to parse it from column names. */
  const table = resizable(el('table', { class: 'data fill-panel' },
    el('thead', {}, el('tr', {},
      el('th', {}, 'Client'),
      el('th', {}, 'Line'),
      el('th', { class: 'num gtyped' },
        `Actual to ${dateAu(date)}`, tip('Internal spend as paid to the media owner, in the line’s own currency', 'Actual spend definition')),
      audColumns.impressions ? el('th', { class: 'num gtyped' }, 'Impressions') : null,
      audColumns.clicks ? el('th', { class: 'num gtyped' }, 'Clicks') : null,
      ...counters.map((d) => el('th', { class: 'num gtyped' }, d.name, tip(kpiFormula(d, defs), `${d.name} formula`))),
      audColumns.internalAud ? el('th', { class: 'num gcalc' },
        'Internal AUD', tip('The same figure converted to AUD at this campaign’s rate', 'Internal AUD definition')) : null,
      audColumns.clientAud ? el('th', { class: 'num gcalc' },
        'Client AUD', tip('What the client is billed for it: internal ÷ (1 − margin)', 'Client AUD definition')) : null,
      ...visibleRatesK.map((d) => el('th', { class: 'num gcalc' }, d.name,
        tip(`${kpiFormula(d, defs)}${d.num === 'spend' ? ' · follows the Internal / Client-facing toggle' : ''}`, `${d.name} formula`))),
      el('th', { class: 'num' }, 'Spent to date', tip('Total spent on this line across the whole flight', 'Spent to date definition')),
      el('th', { class: 'num' }, 'Should be', tip('What the plan’s schedule says should have been spent by today', 'Scheduled spend definition')),
      el('th', { class: 'num' }, 'Variance', tip('Spent minus scheduled. Negative means the money is still owed to the campaign.', 'Variance definition')),
      el('th', { class: 'num' }, 'Run at', tip('Everything not yet spent ÷ days left in the flight. Carries an underspend forward.', 'Daily spend guidance')),
      el('th', {}, 'What to do'),
      el('th', { class: 'num' }, 'Margin'),
      el('th', {}, 'Actions'))),
    /* Width memory is keyed by column count, so a saved layout from before a
       column was added or removed never lands on the wrong columns. (The v2
       prefix retired layouts saved under the pre-reorder column order.) */
    body), entryWidthKey(), [
      128, COLW[0], COLW[1],
      ...(audColumns.impressions ? [COLW[4]] : []),
      ...(audColumns.clicks ? [COLW[5]] : []),
      ...counters.map(() => 96),
      ...(audColumns.internalAud ? [COLW[2]] : []),
      ...(audColumns.clientAud ? [COLW[3]] : []),
      ...visibleRatesK.map(() => 96), ...COLW.slice(6)]);
  /* Fixed-layout tables normally scale every column when min-width:100% adds
     spare room. Put that spare room into Line instead, so What to do keeps its
     deliberate 220px width while the table still reaches both card edges. */
  requestAnimationFrame(() => {
    const group = table.querySelector('colgroup.rz');
    const wrap = table.closest('.tablewrap');
    if (!group || !wrap || group.children.length < 2) return;
    const widths = [...group.children].map((c) => parseFloat(c.style.width || 0));
    const total = widths.reduce((a, b) => a + b, 0);
    const slack = wrap.clientWidth - total;
    if (slack <= 1) return;
    group.children[1].style.width = `${widths[1] + slack}px`;
    table.style.width = `${wrap.clientWidth}px`;
  });
  return table;
}

/* Line and What-to-do carry sentences; the rest are figures and only need
   enough room for the widest number plus its caption.
 *
 * Twelve columns do not fit a laptop, so every column that was carrying slack
 * was pushing What-to-do — the one column that tells you what to actually do —
 * off the right edge. These are sized to the widest figure each one holds;
 * anything narrower than its own header is widened back by the drag floor. */
const COLW = [
  210,  // Line (client over platform · placement)
  100,  // Spend
  92,   // Internal AUD
  92,   // Client AUD
  100,  // Impressions — floor widens this to fit the word
  92,   // Clicks — cell padding (20) + input min-width (68) need 88; below
        // that the input's left edge is clipped at the cell boundary
  106,  // Spent to date ("of $15,000" underneath)
  88,   // Should be
  94,   // Variance
  112,  // Run at — daily pace plus the remaining month target
  220,  // What to do — concise advice plus monthly and cumulative budgets
  96,   // Margin — 100.0% plus the tag's horizontal padding
  144,  // Actions — Edit and Delete buttons plus cell padding
];

function varianceCell(r) {
  if (Math.abs(r.variance) < 1) return el('span', { class: 'tag good' }, 'on plan');
  const behind = r.variance < 0;
  const severity = Math.abs(r.variance) / Math.max(r.due, 1) > 0.25 ? 'crit' : 'warn';
  return el('span', { class: 'tag ' + severity },
    `${behind ? '−' : '+'}${money(Math.abs(r.variance))}`);
}

function platformTag(platform) {
  return platform
    ? el('span', {
      class: 'tag platformtag',
      style: { color: PLATFORM_COLOR[platform] || 'var(--ink-2)' },
    }, el('span', { class: 'pd' }), platform)
    : el('span', { class: 'tag platformtag muted' }, 'Platform —');
}

/** The stored value is only an override. Automatic follows the flight dates,
 * so extending a campaign advances the status without somebody editing every
 * line. Paused / Stopped / an early Completed are human decisions and stick. */
function statusControl(m, shownStatus, state, rerender) {
  const stored = m.line.status || 'Not started';
  const current = stored === 'Paused' ? 'paused'
    : stored === 'Stopped' ? 'stopped'
      : stored === 'Completed' ? 'completed' : 'automatic';
  const kind = shownStatus === 'Live' ? 'good'
    : shownStatus === 'Paused' ? 'warn'
      : shownStatus === 'Stopped' ? 'crit' : '';

  return el('button', {
    type: 'button', class: `tag statusbtn ${kind}`.trim(),
    'data-line-status': m.line.id,
    'aria-label': `Change operational status. Current status: ${shownStatus}`,
    onclick: () => {
      const status = choiceField('Operational status', [
        {
          value: 'automatic', label: `Automatic schedule — currently ${shownStatus}`,
          note: 'Uses the flight dates: Not started before launch, Live in flight, Completed after it ends.',
        },
        {
          value: 'paused', label: 'Paused',
          note: 'Keeps the line visible and editable, but removes the instruction to keep spending until resumed.',
        },
        {
          value: 'stopped', label: 'Stopped',
          note: 'A deliberate early stop. Historical spend stays in every total and report.',
        },
        {
          value: 'completed', label: 'Completed early',
          note: 'Marks delivery complete before the booked flight end. Historical spend stays.',
        },
      ], { value: current });
      dialog({
        title: 'Change line status',
        sub: `${m.clientName} · ${lineLabel(m)}`,
        content: [status],
        actions: [
          { label: 'Cancel' },
          { label: 'Apply', primary: true, onClick: () => {
            const next = {
              automatic: 'Not started', paused: 'Paused', stopped: 'Stopped', completed: 'Completed',
            }[status.value()];
            const nextShown = effectiveStatus({ ...m.line, status: next }, m.campaign);
            put('line', { id: m.line.id, status: next });
            const filter = state.filters?.status;
            toast(`Status changed to ${nextShown}${filter && filter !== nextShown
              ? ` · hidden by the current ${filter} filter` : ''}`, 'ok', 6000);
            rerender();
          } },
        ],
      });
    },
  }, shownStatus);
}

/** Execution advice in the currency the tracker can actually set in-platform. */
function localPaceAdvice(r, m, status) {
  if (!r) return null;
  if (status === 'Paused') return { kind: 'warn', text: 'Paused — hold spend until resumed.' };
  if (status === 'Stopped') return { kind: 'crit', text: 'Stopped — no further spend.' };
  if (status === 'Completed' && !r.finished) {
    return { kind: 'ok', text: 'Completed early — no further spend.' };
  }
  const v = r.localVariance;
  const amount = money2(Math.abs(v), m.ccy);
  if (r.finished) {
    return v < -1
      ? { kind: 'crit', text: `${amount} behind` }
      : { kind: v > 1 ? 'warn' : 'ok', text: v > 1
        ? `${amount} ahead` : 'On plan' };
  }
  if (Math.abs(v) < 1) {
    return { kind: 'ok', text: 'On plan' };
  }
  if (v < 0) {
    return { kind: Math.abs(v) / Math.max(r.localDue, 1) > 0.25 ? 'crit' : 'warn',
      text: `${amount} behind` };
  }
  return { kind: 'ok', text: `${amount} ahead` };
}

const lineLabel = (m) =>
  shown(m.line.placement) || shown(m.line.supplier) || shown(m.line.objective) || 'Line';

/**
 * The creative's own artwork, inline in its row.
 *
 * A name like "Creative B" tells you nothing three months later; the picture
 * does. Small enough not to change the row's rhythm, and it grows on hover so
 * the ad can actually be read without leaving the grid.
 *
 * Images are not in the boot read, so the first render of a split line asks
 * for them and repaints once they land.
 */
/**
 * The enlarged preview.
 *
 * It lives on <body>, not inside the row, and that is the whole point. Two
 * ancestors clip anything positioned inside the table — .tablewrap scrolls
 * (overflow: auto) and .panel hides its own overflow — so an absolutely
 * positioned copy was cut off wherever it reached past either of them: at the
 * top of the panel, at the bottom, and sideways once the table was scrolled.
 * A fixed layer on the body has no such ancestor, so the picture can float
 * over the table the way a preview should, covering whatever is underneath.
 *
 * One layer, reused. It never takes the pointer, so hovering it cannot change
 * what is hovered — the flicker loop that an enlarge-in-place version caused.
 */
const POP_GAP = 8;
const POP_EDGE = 10;                 // keep this clear of the window edges
let popLayer = null;
let popOwner = null;
let popThumb = null;

function popHost() {
  if (!popLayer) {
    popLayer = el('div', { class: 'crpop', 'aria-hidden': 'true' });
    document.body.appendChild(popLayer);
    /* Positioned against the viewport, so a scroll moves the row out from
       under it. Follow the thumbnail rather than vanishing — scrolling a long
       table while looking at a picture is a normal thing to do. */
    addEventListener('scroll', trackPop, true);
    addEventListener('resize', trackPop);
  }
  return popLayer;
}

function hidePop() {
  if (popLayer) popLayer.classList.remove('on');
  popThumb = null;
}

/** Keep the preview with its thumbnail, and drop it once that leaves. */
function trackPop() {
  if (!popThumb || !popLayer?.classList.contains('on')) return;
  const box = popThumb.getBoundingClientRect();
  if (!popThumb.isConnected || box.bottom < 0 || box.top > innerHeight) { hidePop(); return; }
  place(popThumb);
}

function showPop(thumb, src) {
  const layer = popHost();
  if (popOwner !== src) { fill(layer, el('img', { src, alt: '' })); popOwner = src; }
  popThumb = thumb;
  layer.classList.add('on');
  place(thumb);
}

function place(thumb) {
  const layer = popLayer;
  const box = thumb.getBoundingClientRect();
  const pop = layer.getBoundingClientRect();
  const vw = innerWidth;
  const vh = innerHeight;

  /* The header is sticky inside the table, so it is what a preview would cover
     first — clear it, and the top of the window, whichever is lower down. */
  const head = thumb.closest('table')?.querySelector('thead');
  const ceiling = Math.max(POP_EDGE, head ? head.getBoundingClientRect().bottom : 0);

  const above = box.top - ceiling - POP_GAP;
  const under = vh - box.bottom - POP_GAP - POP_EDGE;
  /* Above by preference, below when there is more room there, and clamped into
     the window when neither side can hold it. */
  let top = above >= pop.height || above >= under
    ? box.top - POP_GAP - pop.height
    : box.bottom + POP_GAP;
  top = Math.min(Math.max(top, ceiling), vh - pop.height - POP_EDGE);

  const left = Math.min(Math.max(box.left, POP_EDGE), vw - pop.width - POP_EDGE);

  layer.style.top = `${Math.round(top)}px`;
  layer.style.left = `${Math.round(left)}px`;
}


/**
 * A creative's own artwork, inline in its row.
 *
 * Images are not in the boot read, so the first render of a split line asks
 * for them and repaints once they land.
 */
function creativeThumb(c) {
  if (c.preview_image === undefined) return null;
  if (!c.preview_image) return null;

  const thumb = el('span', {
    class: 'crthumb', tabindex: '0',
    onpointerenter: () => showPop(thumb, c.preview_image),
    onpointerleave: hidePop,
    onfocus: () => showPop(thumb, c.preview_image),
    onblur: hidePop,
  }, el('img', {
    class: 'crthumb-sm', src: c.preview_image,
    alt: `${c.name || 'Creative'} artwork`, loading: 'lazy',
  }));
  return thumb;
}

/* ------------------------------------------------------- creative rows */

/**
 * A creative's own row: indented under its line, and the only place its
 * numbers can be typed. Its pacing cells are monthly and creative-specific;
 * the parent row above keeps the whole line's flight position.
 */
function creativeRow(m, label, figures, opts = {}) {
  const { readonly, note, side = 'internal', counters = [], rates = [],
    audColumns = { internalAud: true, clientAud: true }, focusBase = '',
    onSpend, onImp, onClicks, onExtra } = opts;
  /* Built fresh each time rather than cloned — el() is the app's own node
     factory and cloneNode is not part of that contract. */
  const dim = () => el('td', { class: 'num muted' }, '');

  return el('tr', { class: 'crrow' + (m.billable ? '' : ' nb') },
    el('td', { class: 'wrap clientcell' }, ''),
    el('td', { class: 'wrap' },
      el('span', { class: 'crname' }, label),
      opts.creative ? creativeThumb(opts.creative) : null,
      note ? el('div', { class: 'muted', style: { fontSize: '11px', color: 'var(--warn)' } }, note) : null),

    el('td', { class: 'num' },
      readonly
        ? el('div', { class: 'derived' }, money2(figures.spend, m.ccy))
        : el('input', {
          class: 'cellinput', type: 'number', step: '0.01',
          value: figures.typed ? figures.typed.spend : '',
          placeholder: figures.at ? '' : '0',
          'aria-label': `Running total for ${label}`, 'data-focus': `${focusBase}|s`,
          onchange: (e) => confirmRise(e.target, figures, m, (v) => onSpend(v)),
        }),
      readonly ? null : carriedNote(figures, m, opts.date)),

    audColumns.impressions ? countCell(readonly, figures.imp, figures.typed?.imp ?? null,
      'Impressions', onImp, `${focusBase}|i`) : null,
    audColumns.clicks ? countCell(readonly, figures.clicks, figures.typed?.clicks ?? null,
      'Clicks', onClicks, `${focusBase}|c`) : null,
    ...counters.map((d) => countCell(readonly, figures.extra?.[d.id],
      figures.typed?.extra?.[d.id] ?? null, d.name, (v) => onExtra(d.id, v), `${focusBase}|${d.id}`)),

    audColumns.internalAud ? el('td', { class: 'num muted' }, money(figures.spend / m.rate)) : null,
    audColumns.clientAud ? el('td', { class: 'num muted' }, m.billable
      ? money(grossUp(figures.spend / m.rate, m.margin)) : 'n/a') : null,
    ...rates.map((d) => rateCell(d, {
      spend: spendForSide(figures.spend / m.rate, side, m.margin, m.billable),
      imp: figures.imp, clicks: figures.clicks, extra: figures.extra,
    })),

    creativePaceCells(m, opts.pace, dim),
    dim(),
    el('td', { class: 'cractions' },
      opts.onEdit ? el('button', {
        class: 'btn sm credit', 'aria-label': `Edit ${label}`,
        onclick: opts.onEdit,
      }, 'Edit') : null,
      opts.onDelete ? el('button', {
        class: 'btn sm crdelete', 'aria-label': `Delete ${label}`,
        onclick: opts.onDelete,
      }, 'Delete') : null));
}

function creativePaceCells(m, pace, dim) {
  if (!pace) {
    return [dim(), dim(), dim(), dim(),
      el('td', { class: 'wrap prose muted' }, 'Set dates and booking budget')];
  }
  const behind = pace.variance < 0;
  const severity = Math.abs(pace.variance) / Math.max(pace.expected, 1) > 0.25 ? 'crit' : 'warn';
  const variance = Math.abs(pace.variance) < 1
    ? el('span', { class: 'tag good' }, 'on plan')
    : el('span', { class: `tag ${severity}` },
      `${behind ? '−' : '+'}${money2(Math.abs(pace.variance), m.ccy)}`);
  const spendPct = Math.min(1, Math.max(0, pace.spendPct || 0));
  const timePct = Math.min(1, Math.max(0, pace.timePct || 0));
  const meterKind = (pace.spendPct || 0) > timePct * 1.15 ? 'over'
    : (pace.spendPct || 0) < timePct * 0.85 ? 'under' : '';

  return [
    el('td', { class: 'num' }, money2(pace.monthSpent, m.ccy),
      el('div', { class: 'muted', style: { fontSize: '11px' } },
        `of ${money2(pace.monthBudget, m.ccy)} this month`)),
    el('td', { class: 'num muted' }, money2(pace.expected, m.ccy)),
    el('td', { class: 'num' }, variance),
    el('td', { class: 'num' },
      el('b', {}, `${money2(pace.suggestedDaily, m.ccy)} / day`),
      el('div', { class: 'muted', style: { fontSize: '11px' } }, `${pace.daysLeft} days left`)),
    el('td', { class: 'wrap prose' },
      el('div', { class: 'crpacecopy' },
        `This Month ${money2(pace.monthSpent, m.ccy)} of ${money2(pace.monthBudget, m.ccy)}`),
      el('div', { class: 'meter crmeter' },
        el('i', { class: meterKind, style: { width: `${spendPct * 100}%` } }),
        el('u', { style: { left: `${timePct * 100}%` } })),
      tip('Fill = spend progress · tick = time progress', 'Creative pacing bar')),
  ];
}

function deleteCreativeDialog(m, creative, spends, rerender) {
  const impact = cumulative(spends).spend;
  confirmDanger({
    title: `Delete ${creative.name || 'this creative'}?`,
    detail: spends.length
      ? `This permanently deletes ${spends.length} cumulative ${spends.length === 1 ? 'snapshot' : 'snapshots'}. `
        + `The line and campaign totals will decrease by ${money2(impact, m.ccy)}.`
      : 'This creative has no tracked snapshots yet.',
    note: 'If the creative has simply finished running, set its end date instead. It will leave today’s Tracking Entry while its historical spend stays in the totals.',
    confirmLabel: 'Delete creative and data',
    onBackup: exportBackup,
    onConfirm: () => {
      deleteCreative(creative.id);
      rerender();
      toast(`${creative.name || 'Creative'} deleted${impact ? ` · totals reduced by ${money2(impact, m.ccy)}` : ''}`);
    },
  });
}

function editCreativeDialog(m, creative, rerender) {
  const name = el('input', { value: creative.name || '', placeholder: 'Creative name' });
  const from = el('input', {
    type: 'date', value: creative.live_from || m.campaign.start_date || '',
  });
  const to = el('input', {
    type: 'date', value: creative.live_to || m.campaign.end_date || '',
  });
  const target = el('input', {
    type: 'number', min: '0', step: '0.01', value: creative.target_budget ?? '',
    placeholder: '0',
  });
  const err = errorLine();
  dialog({
    title: `Edit ${creative.name || 'creative'}`,
    sub: 'Dates decide when this row appears. The whole-flight booking budget drives its evenly paced monthly tracking bar.',
    width: '520px',
    content: [
      el('div', { class: 'field' }, el('label', {}, 'Creative name'), name),
      el('div', { class: 'row2' },
        el('div', { class: 'field' }, el('label', {}, 'Start date'), from),
        el('div', { class: 'field' }, el('label', {}, 'End date'), to)),
      el('div', { class: 'field' },
        el('label', {}, `Booking budget · ${m.ccy}`), target,
        tip('Enter the whole creative booking budget. Cross-month budgets are split evenly across active days.', 'Creative booking budget help')),
      err,
    ],
    actions: [
      { label: 'Cancel' },
      { label: 'Save changes', primary: true, onClick: () => {
        const creativeName = name.value.trim();
        if (!creativeName) { err.say('Give the creative a name.'); return false; }
        if (!from.value || !to.value) { err.say('Set both the start and end date.'); return false; }
        if (from.value > to.value) { err.say('The end date must be on or after the start date.'); return false; }
        if ((m.campaign.start_date && from.value < m.campaign.start_date)
          || (m.campaign.end_date && to.value > m.campaign.end_date)) {
          err.say('Keep the creative dates inside the campaign flight.'); return false;
        }
        const budget = Number(target.value);
        if (!(budget > 0)) { err.say(`Set a booking budget in ${m.ccy}.`); return false; }
        put('creative', {
          id: creative.id, name: creativeName,
          live_from: from.value, live_to: to.value, target_budget: budget,
        });
        rerender();
        toast(`${creativeName} updated`);
        return undefined;
      } },
    ],
  });
  setTimeout(() => name.select(), 30);
}

/** A computed KPI cell. Never an input at any level — see calc.kpiValue. */
function rateCell(def, totals) {
  const v = kpiValue(def, totals);
  return el('td', { class: 'num muted' },
    formatKpi(def, v, { money, int, pct }), tip(kpiFormula(def), `${def.name} formula`));
}

/* --------------------------------------------------------- add-column UI */

/**
 * The add-column dialog, shaped around how a tracker actually thinks:
 * "I want to watch H5 clicks" — so they type the number they will record, and
 * the rates that make it meaningful (cost per, rate vs clicks) are offered in
 * the same breath, pre-wired to the right arithmetic. Presets cover the three
 * classics. Columns are global across clients; one added for a single
 * campaign is simply empty elsewhere, which is fine.
 */
function addColumnDialog(rerender) {
  const err = errorLine();
  const name = textField('Track a new number', {
    placeholder: 'e.g. H5 clicks · Followers gained · Form submits',
  });

  const cb = (labelText, subText, checked) => {
    const input = el('input', { type: 'checkbox', checked });
    const node = el('label', { class: 'choice', style: { alignItems: 'center' } },
      input, el('span', {}, el('b', {}, labelText), el('span', { class: 'cnote' }, subText)));
    node.checked = () => input.checked;
    return node;
  };
  const costPer = cb('Also add “Cost per …”', 'spend ÷ this number, named after what you type above', true);
  const rateVs = cb('Also add “… rate”', 'this number ÷ clicks, shown as a %. For counters that happen after a click.', false);

  const presetRow = el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' } },
    ...PRESETS.map((pr) => el('span', { class: 'preset-option-v2' },
      el('button', {
        class: 'btn sm', disabled: hasPreset(pr),
        onclick: () => { addKpi({ ...pr }); rerender(); toast(`${pr.name} column added`); },
      }, hasPreset(pr) ? `${pr.name} ✓` : `+ ${pr.name}`),
      tip(kpiFormula(pr), `${pr.name} formula`))));

  const existing = kpiDefs();
  const existingList = existing.length
    ? el('div', { class: 'field' },
      el('label', {}, 'Columns already added'),
      el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
        ...existing.map((d) => el('span', { class: 'tag' }, d.name,
          tip(kpiFormula(d), `${d.name} formula`),
          el('button', {
            class: 'btn ghost sm', style: { padding: '0 4px', lineHeight: 1 },
            'aria-label': `Remove ${d.name} column`,
            onclick: (e) => {
              e.preventDefault();
              const linked = existing.filter((x) => x.id !== d.id && (x.den === d.id || x.num === d.id));
              confirmDanger({
                title: `Remove “${d.name}” column?`,
                detail: linked.length
                  ? `${linked.length} calculated column${linked.length === 1 ? '' : 's'} built on it will be hidden too.`
                  : 'The column will be hidden from Tracking Entry and exports.',
                confirmLabel: 'Remove column',
                note: 'Typed values stay attached to their original id. Re-adding the same column restores its history.',
                onConfirm: () => {
                  removeKpi(d.id); rerender();
                  closeDialog(); addColumnDialog(rerender);
                },
              });
            },
          }, '✕')))))
    : null;

  dialog({
    title: 'Add a column',
    sub: 'Counters are typed like clicks; rates are computed and never typed. On a split line, counters sum from the creatives and rates recompute from the sums.',
    width: '520px',
    content: [
      el('div', { class: 'field' }, el('label', {}, 'Quick presets'), presetRow),
      name, costPer, rateVs, el('div', { style: { height: '10px' } }), err, existingList,
    ].filter(Boolean),
    actions: [
      { label: 'Close' },
      {
        label: 'Add column', primary: true,
        onClick: () => {
          const n = name.value();
          if (!n) { err.say('Name the number first — it becomes the column header.'); return false; }
          if (kpiDefs().some((d) => d.name.toLowerCase() === n.toLowerCase())) {
            err.say(`“${n}” already exists. Remove it below first if you want to redefine it.`);
            return false;
          }
          const counter = addKpi({ name: n, kind: 'counter' });
          for (const [box, comp] of [[costPer, 0], [rateVs, 1]]) {
            if (box.checked()) addKpi(companionsFor(n, counter.id)[comp]);
          }
          rerender();
          toast(`“${n}” added${costPer.checked() || rateVs.checked() ? ' with its companion rate' : ''} — it appears after Clicks.`, 'ok', 6000);
          return undefined;
        },
      },
    ],
  });
  setTimeout(() => name.focus(), 30);
}

/** Impressions / clicks: an input, or the derived sum when the row is a total. */
/**
 * A counter cell: running total in, running total out.
 *
 * `carried` is what the line already reports; `typed` is what was entered on
 * the day in view. The box holds the typed figure so an empty box means
 * "nobody recorded this today", and the carried figure sits behind it as the
 * placeholder so the number to check against is on screen either way.
 */
function countCell(derived, carried, typed, label, onChange, focusKey) {
  if (derived) {
    return el('td', { class: 'num' },
      el('div', { class: 'derived' }, carried ? int(carried) : '—'));
  }
  const carriedHelp = carried && typed == null
    ? `Carried forward: ${int(carried)}. Type today's running total to move it.`
    : '';
  return el('td', { class: 'num' }, el('input', {
    class: 'cellinput', type: 'number', step: '1',
    value: typed == null ? '' : typed,
    placeholder: carried ? String(Math.round(carried)) : '',   // counters have no note of their own
    'aria-label': label, 'data-focus': focusKey,
    onchange: (e) => onChange(Number(e.target.value) || null),
  }), carriedHelp ? tip(carriedHelp, `${label} carried value`) : null);
}

/** The currency caption under the spend cell, plus the finished-flight note. */
/**
 * What the line already reports, and as at when.
 *
 * The box holds what was typed on the day in view, which is empty until
 * somebody types — so without this there is no way to tell "nobody has
 * recorded anything" from "the total is zero", and no way to sanity-check a
 * new figure against the last one. It also answers the month-end question:
 * a July column settled to the 28th is not a full month, and says so.
 */
function carriedNote(bucket, m, date) {
  if (!bucket.at || bucket.typed) return null;
  return el('div', { class: 'muted', style: { fontSize: '11px', paddingRight: '7px' } },
    `${money2(bucket.spend, m.ccy)} at ${dateAu(bucket.at)}`,
    tip(`Nothing recorded on ${dateAu(date)}. This is the running total carried forward from ${dateAu(bucket.at)}.`, 'Carried spend'));
}

/**
 * A running total that goes backwards, questioned but not forbidden.
 *
 * Cumulative figures normally only rise. One that falls means either a typo
 * now or a wrong number earlier — and the earlier one is the more likely, so
 * blocking outright would trap somebody who is in the middle of fixing it.
 * Ask, name both figures, and let them through.
 */
function confirmRise(input, bucket, m, commit) {
  const typed = Number(input.value) || 0;
  const previous = bucket.at && !bucket.typed ? bucket.spend : null;
  if (previous == null || typed >= previous || !typed) { commit(typed); return; }

  const restore = () => { input.value = bucket.typed ? bucket.typed.spend : ''; };
  dialog({
    title: 'That is lower than the last total',
    content: [el('p', {}, `${money2(typed, m.ccy)} is below the ${money2(previous, m.ccy)} recorded on `
      + `${dateAu(bucket.at)}. A running total does not usually go down.`),
    el('p', { class: 'hint' },
      'If the earlier figure was the wrong one, fix that entry rather than this one — '
      + 'otherwise every month in between is computed from it. If this is a correction '
      + 'the platform itself made, carry on.')],
    actions: [
      { label: 'Leave it as it was', onClick: restore },
      { label: 'Save it anyway', primary: true, onClick: () => commit(typed) },
    ],
  });
}

function flightNote(m, r, day, activeCount = day.parts.length) {
  if (day.split) {
    return el('div', { class: 'muted', style: { fontSize: '11px', paddingRight: '7px' } },
      `${m.ccy} · ${activeCount} active${activeCount !== day.parts.length ? ` · ${day.parts.length} total` : ''}`);
  }
  /* A finished flight still accepts entries — a late invoice is real money —
     but it should never accept them *unremarked*. */
  if (r?.finished) {
    return el('div', { class: 'muted',
      style: { fontSize: '11px', paddingRight: '7px', color: 'var(--warn)' } },
      `${m.ccy} · flight ended`,
      tip(m.campaign.end_date
        ? `This flight ended ${dateAu(m.campaign.end_date)}. An entry here is a late actual: it lands in the flight's history, not in a running month.`
        : 'This flight has ended. An entry here is a late actual.', 'Finished flight'));
  }
  return el('div', { class: 'muted', style: { fontSize: '11px', paddingRight: '7px' } }, m.ccy);
}

/**
 * The opt-in: split a line into creatives, or add another one.
 *
 * Splitting is offered, never imposed — a line with no creatives is tracked
 * whole, which is what most lines want. But the moment one exists, the line's
 * own figure stops being typeable and starts being the sum, so the first split
 * has to deal honestly with money that was already entered at line level.
 */
function creativeControl(m, creatives, spends, date, rerender) {
  const create = (fields) => {
    const id = newId('cr');
    put('creative', { id, line_id: m.line.id, status: 'Live', live_from: '', ...fields });
    return id;
  };

  /* --- adding a second, third… creative: nothing to decide. */
  if (creatives.length) {
    return el('button', {
      class: 'btn chip', 'aria-label': 'Add another creative to this line',
      onclick: () => nameDialog(m, 'Add a creative', `Creative ${String.fromCharCode(65 + creatives.length)}`,
        (fields) => { create(fields); rerender(); }),
    }, '+ Creative');
  }

  /* --- the first split. Money already on the line has to go somewhere, and
     the three destinations differ in consequence, so the choice is explicit
     and carries its own numbers. Silently adopting it would rewrite history;
     silently stranding it would leave a total nobody can explain; and clearing
     it is a real deletion that must never happen by default. */
  const loose = spends.filter((s) => !s.creative_id);
  const looseTotal = looseSpendTotal(creatives, spends);
  const monthOf = (d) => String(d || '').slice(0, 7);
  const thisMonth = loose.filter((s) => monthOf(s.date) === monthOf(date));
  /* These rows are cumulative snapshots. The amount being cleared from this
     month is therefore its closing balance minus its opening balance, never
     the sum of every snapshot shown in the confirmation dialog. */
  const bounds = monthBounds(monthOf(date));
  const thisMonthTotal = periodSpend(loose, bounds.start, bounds.end).spend;

  return el('button', {
    class: 'btn chip',
    'aria-label': 'Split this line into separately tracked creatives',
    onclick: () => splitDialog(m, { looseTotal, loose, thisMonth, thisMonthTotal, date }, (fields, choice) => {
      const id = create(fields);
      if (choice === 'adopt') {
        for (const s of loose) put('spend', { ...s, creative_id: id });
      } else if (choice === 'clear') {
        for (const s of thisMonth) remove('spend', s.id);
      }
      rerender();
      if (choice === 'clear' && thisMonth.length) {
        toast(`Cleared ${thisMonth.length} line-level ${thisMonth.length === 1 ? 'entry' : 'entries'} for ${monthLabel(monthOf(date))} — re-enter them per creative.`, 'ok', 8000);
      }
    }),
  }, '+ Split by creative');
}

function lineControls(m, creatives, spends, date, rerender) {
  return el('div', { class: 'linecontrols' },
    el('div', { class: 'linebuttons' },
      creativeControl(m, creatives, spends, date, rerender),
      logControl(m, rerender)),
    creatives.length ? allocationWarning(m, creatives) : null);
}

function allocationLabel(className, label, copy) {
  return el('span', { class: className }, label, tip(copy, 'Creative allocation'));
}

function allocationWarning(m, creatives) {
  const lineBudget = Number(m.line.cost_media || 0) * m.rate;
  if (!lineBudget || !creatives.length) return null;
  const allocated = creatives.reduce((a, c) => a + Number(c.target_budget || 0), 0);
  const gap = lineBudget - allocated;
  if (Math.abs(gap) < 1) return allocationLabel('allocation ok', 'Budget allocated',
    `Creative booking budgets total ${money2(allocated, m.ccy)} and match the line budget of ${money2(lineBudget, m.ccy)}.`);
  const state = gap < 0 ? 'over allocated' : 'unallocated';
  return allocationLabel(`allocation ${gap < 0 ? 'over' : 'under'}`,
    `${money2(Math.abs(gap), m.ccy)} ${state}`,
    `Creative booking budgets total ${money2(allocated, m.ccy)} against the line budget of ${money2(lineBudget, m.ccy)}. The ${money2(Math.abs(gap), m.ccy)} difference is ${state}. This is a warning only and does not block saving.`);
}

/**
 * Name, flight dates and booking budget are required because they drive the
 * monthly pacing row. Artwork references remain optional.
 */
function creativeFields(suggested, m) {
  const name = textField('Creative name', {
    value: suggested, placeholder: 'e.g. H5 banner – Parents',
  });
  const from = el('input', { type: 'date', value: m.campaign.start_date || '' });
  const to = el('input', { type: 'date', value: m.campaign.end_date || '' });
  const live = el('div', { class: 'row2' },
    el('div', { class: 'field' }, el('label', {}, 'Start date'), from),
    el('div', { class: 'field' }, el('label', {}, 'End date'), to));
  live.value = () => ({ from: from.value, to: to.value });

  const targetInput = el('input', { type: 'number', min: '0', step: '0.01', placeholder: '0' });
  const target = el('div', { class: 'field' },
    el('label', {}, `Booking budget · ${m.ccy}`), targetInput,
    tip('Whole-flight creative booking budget. The monthly share is spread evenly across its active days.', 'Creative booking budget help'));
  target.value = () => Number(targetInput.value) || 0;

  const url = textField('Preview link — optional', {
    placeholder: 'https://…',
    hint: 'Where the artwork lives, if it lives somewhere.',
  });
  const shot = imageField('Screenshot — optional', {
    hint: 'Click the box then ⌘V. Shrunk to 480px wide before it is stored, so it stays a few tens of KB and rides along in the Excel export.',
  });
  return { name, live, target, url, shot,
    nodes: [name, live, target, url, shot],
    values: () => ({
      name: name.value(),
      live_from: live.value().from,
      live_to: live.value().to,
      target_budget: target.value(),
      preview_url: url.value(),
      preview_image: shot.value() || null,
    }) };
}

/** The log button, with a count so a campaign with history says so. */
function logControl(m, rerender) {
  const n = noteCount(m.campaign?.id, m.line?.id);
  return el('button', {
    class: 'btn chip logchip',
    'aria-label': `Open tracking log. ${n} ${n === 1 ? 'entry' : 'entries'}`,
    onclick: () => openLog(m, rerender),
  }, n ? `Log · ${n}` : '+ Log');
}

/** Dialog for every creative after the first. */
function nameDialog(m, title, suggested, done) {
  const err = errorLine();
  const f = creativeFields(suggested, m);
  const submit = () => {
    if (!f.name.value()) { err.say('Give it a name so it can be told apart on the report.'); return false; }
    const dates = f.live.value();
    if (!dates.from || !dates.to) { err.say('Set both the start and end date.'); return false; }
    if (dates.from > dates.to) { err.say('The end date must be on or after the start date.'); return false; }
    if ((m.campaign.start_date && dates.from < m.campaign.start_date)
      || (m.campaign.end_date && dates.to > m.campaign.end_date)) {
      err.say('Keep the creative dates inside the campaign flight.'); return false;
    }
    if (f.target.value() <= 0) { err.say(`Set a booking budget in ${m.ccy}.`); return false; }
    done(f.values());
    return true;
  };
  const box = dialog({
    title,
    sub: 'Creatives are entered separately; the line’s own figure becomes their sum.',
    width: '520px',
    content: [...f.nodes, err],
    actions: [
      { label: 'Cancel' },
      { label: 'Add creative', primary: true, onClick: () => (submit() ? undefined : false) },
    ],
  });
  setTimeout(() => f.name.focus(), 30);
  return box;
}

/** The first split: name it, and say what happens to the spend already there. */
function splitDialog(m, ctx, done) {
  const { looseTotal, loose, thisMonth, thisMonthTotal, date } = ctx;
  const err = errorLine();
  const f = creativeFields('Creative A', m);
  const name = f.name;

  const has = looseTotal > 0.005;
  const choices = [
    {
      value: 'keep',
      label: 'Keep it as recorded before the split',
      note: `${money2(looseTotal, m.ccy)} across ${loose.length} ${loose.length === 1 ? 'day' : 'days'} stays on the line, `
        + 'shown as its own read-only row. It still counts toward the line total. Nothing is lost.',
    },
    {
      value: 'adopt',
      label: 'Move all of it onto this creative',
      note: `Attributes the whole ${money2(looseTotal, m.ccy)} to the creative you are creating. `
        + 'Correct when this line only ever ran one creative.',
    },
    {
      value: 'clear',
      label: `Clear ${monthLabel(String(date).slice(0, 7))} and re-enter per creative`,
      note: thisMonth.length
        ? `Removes ${thisMonth.length} line-level ${thisMonth.length === 1 ? 'snapshot' : 'snapshots'} from this month. `
          + `Their net movement is ${money2(thisMonthTotal, m.ccy)}; earlier months are untouched. `
          + 'Only do this if you have the per-creative split to type back in.'
        : 'Nothing was recorded at line level this month, so this deletes nothing.',
    },
  ];
  const choice = choiceField('The spend already on this line', choices, { value: 'keep' });

  const box = dialog({
    title: 'Split this line by creative',
    sub: 'From here the creatives are the only editable figures. The line’s own number becomes their sum.',
    width: '520px',
    content: has ? [...f.nodes, choice, err] : [...f.nodes, err],
    actions: [
      { label: 'Cancel' },
      {
        label: 'Split line',
        primary: true,
        onClick: () => {
          if (!name.value()) { err.say('Give the creative a name first.'); return false; }
          const dates = f.live.value();
          if (!dates.from || !dates.to) { err.say('Set both the start and end date.'); return false; }
          if (dates.from > dates.to) { err.say('The end date must be on or after the start date.'); return false; }
          if ((m.campaign.start_date && dates.from < m.campaign.start_date)
            || (m.campaign.end_date && dates.to > m.campaign.end_date)) {
            err.say('Keep the creative dates inside the campaign flight.'); return false;
          }
          if (f.target.value() <= 0) { err.say(`Set a booking budget in ${m.ccy}.`); return false; }
          done(f.values(), has ? choice.value() : 'keep');
          return undefined;
        },
      },
    ],
  });
  setTimeout(() => name.focus(), 30);
  return box;
}
