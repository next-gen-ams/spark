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

import { el, money, money2, int, pct, monthLabel, dateAu, toast } from './dom.js';
import { put, remove, where, byId, newId, fxMap } from './store.js';
import { dialog, closeDialog, textField, choiceField, errorLine } from './modal.js';
import { monthBounds, grossUp, repace, repaceAdvice, todayIso, daySplit, looseSpendTotal, kpiValue, spendForSide } from './calc.js';
import { kpiDefs, addKpi, removeKpi, PRESETS, hasPreset, companionsFor, kpiFormula, formatKpi } from './kpis.js';
import { resizable, forgetWidths } from './resizable.js';

const spendId = (lineId, creativeId, date) => `${lineId}|${creativeId || '_'}|${date}`;

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

  host.appendChild(el('div', { class: 'panel' },
    el('header', {},
      el('div', {},
        el('h3', {}, mode === 'today' ? `Today’s numbers · ${dateAu(today)}` : 'Enter internal spend'),
        el('p', {}, modeBlurb(mode, state, date))),
      el('div', { style: { flex: 1 } }),
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
        class: 'btn chip', style: { marginTop: 0 },
        title: 'Track another number — a typed counter like H5 clicks, or a computed rate like CTR',
        onclick: () => addColumnDialog(rerender),
      }, '+ Add column'),
      el('button', {
        class: 'btn ghost sm', title: 'Put every column back to its default width',
        onclick: () => { forgetWidths('tracking-entry'); rerender(); },
      }, 'Reset columns')),
    el('div', { class: 'tablewrap' }, grid(rows, date, mode, state, rerender))));
}

function segBtn(id, label, mode, state, rerender) {
  return el('button', {
    'aria-pressed': mode === id,
    onclick: () => { state.spendMode = id; rerender(); },
  }, label);
}

function modeBlurb(mode, state, date) {
  if (mode === 'today') {
    return 'Type what each line spent today — it saves as you go, and the pacing on the right '
      + 'recalculates against the whole flight, not just this month.';
  }
  return `Writing against ${dateAu(date)}. Use this to fill a day that was missed — `
    + 'monthly totals are worked out from the daily figures, never typed in as one number.';
}

/* ------------------------------------------------------------------ grid */

function grid(rows, date, mode, state, rerender) {
  const fx = fxMap();
  const today = todayIso();
  const side = state.view;
  /* Typed columns first, computed after — mirroring the header's two blocks:
     everything you enter sits together, everything the app derives follows. */
  const all_ = kpiDefs();
  const counters = all_.filter((d) => d.kind === 'counter');
  const ratesK = all_.filter((d) => d.kind !== 'counter');
  const defs = [...counters, ...ratesK];

  const body = el('tbody');
  for (const m of rows) {
    const creatives = where('creative', (c) => c.line_id === m.line.id);
    const spends = where('spend', (x) => x.line_id === m.line.id);
    const day = daySplit(creatives, spends, date);

    /* Pacing belongs to the whole line, so it reads every month and every
       spend row — not the single cell being typed into. It is also computed
       once per line, not once per creative: three creatives do not mean three
       different pacing positions. */
    const r = repace(m.line, m.campaign,
      where('line_month', (x) => x.line_id === m.line.id), spends,
      { fx, today, side });
    const advice = repaceAdvice(r);

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
      el('td', { class: 'wrap' }, m.clientName,
        el('div', { class: 'muted', style: { fontSize: '11px' } },
          `${m.line.platform || '—'} · ${lineLabel(m)}`),
        creativeControl(m, creatives, spends, date, rerender)),

      el('td', { class: 'num' },
        day.split
          ? el('div', { class: 'derived', title: `Sum of ${day.parts.length} creative${day.parts.length === 1 ? '' : 's'} below — type into those, not here.` },
            money2(day.total.spend, m.ccy))
          : el('input', {
            class: 'cellinput', type: 'number', step: '0.01',
            value: day.loose.spend || '', placeholder: '0',
            'aria-label': `Spend for ${lineLabel(m)}`,
            'data-focus': `${m.line.id}|_|s`,
            onchange: (e) => write(null, { spend_internal: Number(e.target.value) || 0 }),
          }),
        flightNote(m, r, day)),

      /* --- the rest of the typed block: what you enter sits together. */
      countCell(day.split, day.total.imp, 'Impressions', (v) => write(null, { imp: v }), `${m.line.id}|_|i`),
      countCell(day.split, day.total.clicks, 'Clicks', (v) => write(null, { clicks: v }), `${m.line.id}|_|c`),
      ...counters.map((d) =>
        countCell(day.split, day.total.extra[d.id], d.name, (v) => writeExtra(null, d.id, v), `${m.line.id}|_|${d.id}`)),

      /* --- the computed block: the margin doing something, then the rates. */
      el('td', { class: 'num muted' }, money(day.total.spend / m.rate)),
      el('td', { class: 'num' }, m.billable
        ? el('b', {}, money(grossUp(day.total.spend / m.rate, m.margin)))
        : el('span', { class: 'muted' }, 'n/a')),
      ...ratesK.map((d) => rateCell(d, lineTotals())),

      /* --- running position across the whole flight --- */
      el('td', { class: 'num' }, r ? money(r.spent) : '—',
        r ? el('div', { class: 'muted', style: { fontSize: '11px' } }, `of ${money(r.total)}`) : null),
      el('td', { class: 'num muted' }, r ? money(r.due) : '—'),
      el('td', { class: 'num' }, r ? varianceCell(r) : '—'),
      el('td', { class: 'num' }, r && !r.finished
        ? el('div', {}, el('b', {}, money(r.suggestedDaily)),
          el('div', { class: 'muted', style: { fontSize: '11px' } },
            `${r.daysLeft} day${r.daysLeft === 1 ? '' : 's'} left`))
        : el('span', { class: 'muted' }, '—')),
      el('td', { class: 'wrap prose' }, advice
        ? el('span', { class: 'advice ' + (advice.kind === 'ok' ? 'good' : advice.kind) }, advice.text)
        : el('span', { class: 'muted' }, 'no flight dates')),

      el('td', { class: 'num' }, m.billable
        ? el('span', {
          class: 'tag' + (m.margin > 0 ? '' : ' crit'),
          title: m.margin > 0
            ? `Client = internal ÷ FX ÷ (1 − ${(m.margin * 100).toFixed(1)}%)`
            : 'No margin on this line — set it in the line drawer.',
        }, m.margin > 0 ? pct(m.margin, 1) : 'not set')
        : el('span', { class: 'muted' }, '—'))));

    /* ---- one row per creative, and one for anything attributed to none. */
    if (!day.split) continue;
    for (const p of day.parts) {
      body.appendChild(creativeRow(m, p.creative.name || 'Creative', p, {
        side, counters, rates: ratesK, focusBase: `${m.line.id}|${p.creative.id}`,
        onSpend: (v) => write(p.creative.id, { spend_internal: v }),
        onImp: (v) => write(p.creative.id, { imp: v }),
        onClicks: (v) => write(p.creative.id, { clicks: v }),
        onExtra: (defId, v) => writeExtra(p.creative.id, defId, v),
      }));
    }
    if (day.loose.spend || day.loose.imp || day.loose.clicks
      || Object.values(day.loose.extra).some(Boolean)) {
      body.appendChild(creativeRow(m, 'Not attributed to a creative', day.loose, {
        side, counters, rates: ratesK, readonly: true,
        note: 'Typed before this line was split. It still counts toward the line total — '
          + 'move it onto a creative from the line drawer if it belongs to one.',
      }));
    }
  }

  /* Three header tints, one per block: warm for what you type, blue for what
     the app computes, neutral for the flight position. The colour carries the
     grouping so the eye does not have to parse it from column names. */
  return resizable(el('table', { class: 'data' },
    el('thead', {}, el('tr', {},
      el('th', {}, 'Line'),
      el('th', { class: 'num gtyped', title: 'Internal spend as paid to the media owner, in the line’s own currency' },
        `Spend · ${dateAu(date)}`),
      el('th', { class: 'num gtyped' }, 'Impressions'),
      el('th', { class: 'num gtyped' }, 'Clicks'),
      ...counters.map((d) => el('th', { class: 'num gtyped', title: kpiFormula(d, defs) }, d.name)),
      el('th', { class: 'num gcalc', title: 'The same figure converted to AUD at this campaign’s rate' },
        'Internal AUD'),
      el('th', { class: 'num gcalc', title: 'What the client is billed for it — internal ÷ (1 − margin)' },
        'Client AUD'),
      ...ratesK.map((d) => el('th', {
        class: 'num gcalc',
        title: `${kpiFormula(d, defs)}${d.num === 'spend' ? ' · follows the Internal / Client-facing toggle' : ''}`,
      }, d.name)),
      el('th', { class: 'num', title: 'Total spent on this line across the whole flight' }, 'Spent to date'),
      el('th', { class: 'num', title: 'What the plan’s schedule says should have been spent by today' }, 'Should be'),
      el('th', { class: 'num', title: 'Spent minus scheduled. Negative means the money is still owed to the campaign.' }, 'Variance'),
      el('th', { class: 'num', title: 'Everything not yet spent ÷ days left in the flight — carries an underspend forward' }, 'Run at'),
      el('th', {}, 'What to do'),
      el('th', { class: 'num' }, 'Margin'))),
    /* Width memory is keyed by column count, so a saved layout from before a
       column was added or removed never lands on the wrong columns. (The v2
       prefix retired layouts saved under the pre-reorder column order.) */
    body), `tracking-entry2-${counters.length}c${ratesK.length}r`, [
      COLW[0], COLW[1], COLW[4], COLW[5], ...counters.map(() => 96),
      COLW[2], COLW[3], ...ratesK.map(() => 96), ...COLW.slice(6)]);
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
  92,   // Run at
  220,  // What to do
  78,   // Margin
];

function varianceCell(r) {
  if (Math.abs(r.variance) < 1) return el('span', { class: 'tag good' }, 'on plan');
  const behind = r.variance < 0;
  const severity = Math.abs(r.variance) / Math.max(r.due, 1) > 0.25 ? 'crit' : 'warn';
  return el('span', { class: 'tag ' + severity },
    `${behind ? '−' : '+'}${money(Math.abs(r.variance))}`);
}

const lineLabel = (m) =>
  m.line.placement || m.line.supplier || m.line.objective || 'Line';

/* ------------------------------------------------------- creative rows */

/**
 * A creative's own row: indented under its line, and the only place its
 * numbers can be typed. The pacing columns stay empty here on purpose —
 * pacing is a property of the line, and repeating one line's position across
 * three creative rows reads as three different positions.
 */
function creativeRow(m, label, figures, opts = {}) {
  const { readonly, note, side = 'internal', counters = [], rates = [],
    focusBase = '', onSpend, onImp, onClicks, onExtra } = opts;
  /* Built fresh each time rather than cloned — el() is the app's own node
     factory and cloneNode is not part of that contract. */
  const dim = () => el('td', { class: 'num muted' }, '');

  return el('tr', { class: 'crrow' + (m.billable ? '' : ' nb') },
    el('td', { class: 'wrap' },
      el('span', { class: 'crname' }, label),
      note ? el('div', { class: 'muted', style: { fontSize: '11px', color: 'var(--warn)' } }, note) : null),

    el('td', { class: 'num' },
      readonly
        ? el('div', { class: 'derived' }, money2(figures.spend, m.ccy))
        : el('input', {
          class: 'cellinput', type: 'number', step: '0.01',
          value: figures.spend || '', placeholder: '0',
          'aria-label': `Spend for ${label}`, 'data-focus': `${focusBase}|s`,
          onchange: (e) => onSpend(Number(e.target.value) || 0),
        })),

    countCell(readonly, figures.imp, 'Impressions', onImp, `${focusBase}|i`),
    countCell(readonly, figures.clicks, 'Clicks', onClicks, `${focusBase}|c`),
    ...counters.map((d) => countCell(readonly, figures.extra?.[d.id], d.name, (v) => onExtra(d.id, v), `${focusBase}|${d.id}`)),

    el('td', { class: 'num muted' }, money(figures.spend / m.rate)),
    el('td', { class: 'num muted' }, m.billable
      ? money(grossUp(figures.spend / m.rate, m.margin)) : 'n/a'),
    ...rates.map((d) => rateCell(d, {
      spend: spendForSide(figures.spend / m.rate, side, m.margin, m.billable),
      imp: figures.imp, clicks: figures.clicks, extra: figures.extra,
    })),

    dim(), dim(), dim(), dim(),
    el('td', { class: 'wrap prose muted' }, ''),
    dim());
}

/** A computed KPI cell. Never an input at any level — see calc.kpiValue. */
function rateCell(def, totals) {
  const v = kpiValue(def, totals);
  return el('td', { class: 'num muted', title: kpiFormula(def) },
    formatKpi(def, v, { money, int, pct }));
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
  const costPer = cb('Also add “Cost per …”', 'spend ÷ this number — named after what you type above', true);
  const rateVs = cb('Also add “… rate”', 'this number ÷ clicks, shown as a % — for counters that happen after a click', false);

  const presetRow = el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' } },
    ...PRESETS.map((pr) => el('button', {
      class: 'btn sm', disabled: hasPreset(pr),
      title: kpiFormula(pr),
      onclick: () => { addKpi({ ...pr }); rerender(); toast(`${pr.name} column added`); },
    }, hasPreset(pr) ? `${pr.name} ✓` : `+ ${pr.name}`)));

  const existing = kpiDefs();
  const existingList = existing.length
    ? el('div', { class: 'field' },
      el('label', {}, 'Columns already added'),
      el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
        ...existing.map((d) => el('span', { class: 'tag', title: kpiFormula(d) }, d.name,
          el('button', {
            class: 'btn ghost sm', style: { padding: '0 4px', lineHeight: 1 },
            title: 'Remove the column. Typed values stay on the spend rows, so re-adding it brings them back. Rates built on it go with it.',
            onclick: (e) => {
              e.preventDefault();
              removeKpi(d.id); rerender();
              closeDialog(); addColumnDialog(rerender);   // reopen with the list refreshed
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
            err.say(`“${n}” already exists — remove it below first if you want to redefine it.`);
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
function countCell(derived, value, label, onChange, focusKey) {
  if (derived) {
    return el('td', { class: 'num' },
      el('div', { class: 'derived' }, value ? int(value) : '—'));
  }
  return el('td', { class: 'num' }, el('input', {
    class: 'cellinput', type: 'number', step: '1', value: value || '',
    'aria-label': label, 'data-focus': focusKey,
    onchange: (e) => onChange(Number(e.target.value) || null),
  }));
}

/** The currency caption under the spend cell, plus the finished-flight note. */
function flightNote(m, r, day) {
  if (day.split) {
    return el('div', { class: 'muted', style: { fontSize: '11px', paddingRight: '7px' } },
      `${m.ccy} · ${day.parts.length} creative${day.parts.length === 1 ? '' : 's'}`);
  }
  /* A finished flight still accepts entries — a late invoice is real money —
     but it should never accept them *unremarked*. */
  if (r?.finished) {
    return el('div', {
      class: 'muted',
      style: { fontSize: '11px', paddingRight: '7px', color: 'var(--warn)' },
      title: m.campaign.end_date
        ? `This flight ended ${dateAu(m.campaign.end_date)}. An entry here is a late actual — it lands in the flight's history, not in a running month.`
        : 'This flight has ended. An entry here is a late actual.',
    }, `${m.ccy} · flight ended`);
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
  const create = (name) => {
    const id = newId('cr');
    put('creative', { id, line_id: m.line.id, name, live_from: '', status: 'Live' });
    return id;
  };

  /* --- adding a second, third… creative: nothing to decide. */
  if (creatives.length) {
    return el('button', {
      class: 'btn chip', title: 'Add another creative to this line',
      onclick: () => nameDialog('Add a creative', `Creative ${String.fromCharCode(65 + creatives.length)}`,
        (name) => { create(name); rerender(); }),
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
  const thisMonthTotal = thisMonth.reduce((a, s) => a + Number(s.spend_internal || 0), 0);

  return el('button', {
    class: 'btn chip',
    title: 'Track this line as separate creatives. The line total becomes the sum of them.',
    onclick: () => splitDialog(m, { looseTotal, loose, thisMonth, thisMonthTotal, date }, (name, choice) => {
      const id = create(name);
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

/** Name-only dialog, for every creative after the first. */
function nameDialog(title, suggested, done) {
  const err = errorLine();
  const name = textField('Creative name', {
    value: suggested, placeholder: 'e.g. H5 banner – Parents',
    onEnter: () => submit(),
  });
  let box;
  const submit = () => {
    if (!name.value()) { err.say('Give it a name so it can be told apart on the report.'); return false; }
    done(name.value());
    return true;
  };
  box = dialog({
    title,
    sub: 'Creatives are entered separately; the line’s own figure becomes their sum.',
    content: [name, err],
    actions: [
      { label: 'Cancel' },
      { label: 'Add creative', primary: true, onClick: () => (submit() ? undefined : false) },
    ],
  });
  setTimeout(() => name.focus(), 30);
  return box;
}

/** The first split: name it, and say what happens to the spend already there. */
function splitDialog(m, ctx, done) {
  const { looseTotal, loose, thisMonth, thisMonthTotal, date } = ctx;
  const err = errorLine();
  const name = textField('Name of the first creative', {
    value: 'Creative A', placeholder: 'e.g. H5 banner – Parents',
  });

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
      note: `Attributes the whole ${money2(looseTotal, m.ccy)} to the creative you are creating — `
        + 'right when this line only ever ran one creative.',
    },
    {
      value: 'clear',
      label: `Clear ${monthLabel(String(date).slice(0, 7))} and re-enter per creative`,
      note: thisMonth.length
        ? `Deletes ${money2(thisMonthTotal, m.ccy)} across ${thisMonth.length} `
          + `${thisMonth.length === 1 ? 'day' : 'days'} of line-level entries in this month. Earlier months are untouched. `
          + 'Only do this if you have the per-creative split to type back in.'
        : 'Nothing was recorded at line level this month, so this deletes nothing.',
    },
  ];
  const choice = choiceField('The spend already on this line', choices, { value: 'keep' });

  const box = dialog({
    title: 'Split this line by creative',
    sub: 'From here, the creatives are the only editable figures — the line’s own number becomes their sum.',
    width: '520px',
    content: has ? [name, choice, err] : [name, err],
    actions: [
      { label: 'Cancel' },
      {
        label: 'Split line',
        primary: true,
        onClick: () => {
          if (!name.value()) { err.say('Give the creative a name first.'); return false; }
          done(name.value(), has ? choice.value() : 'keep');
          return undefined;
        },
      },
    ],
  });
  setTimeout(() => name.focus(), 30);
  return box;
}


