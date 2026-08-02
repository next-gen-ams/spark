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

import { el, money, money2, int, pct, monthLabel, dateAu } from './dom.js';
import { put, where, newId, fxMap } from './store.js';
import { monthBounds, grossUp, repace, repaceAdvice, todayIso, daySplit, looseSpendTotal } from './calc.js';
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

    /* ---- the line's own row. Editable only while nothing is split off it. */
    body.appendChild(el('tr', { class: m.billable ? '' : 'nb' },
      el('td', { class: 'wrap' }, m.clientName,
        el('div', { class: 'muted', style: { fontSize: '11px' } },
          `${m.line.platform || '—'} · ${lineLabel(m)}`),
        creativeControl(m, creatives, spends, rerender)),

      el('td', { class: 'num' },
        day.split
          ? el('div', { class: 'derived', title: `Sum of ${day.parts.length} creative${day.parts.length === 1 ? '' : 's'} below — type into those, not here.` },
            money2(day.total.spend, m.ccy))
          : el('input', {
            class: 'cellinput', type: 'number', step: '0.01',
            value: day.loose.spend || '', placeholder: '0',
            'aria-label': `Spend for ${lineLabel(m)}`,
            onchange: (e) => write(null, { spend_internal: Number(e.target.value) || 0 }),
          }),
        flightNote(m, r, day)),

      /* (2) the two derived figures, back where they were asked for: this is
         where you see the margin actually doing something. */
      el('td', { class: 'num muted' }, money(day.total.spend / m.rate)),
      el('td', { class: 'num' }, m.billable
        ? el('b', {}, money(grossUp(day.total.spend / m.rate, m.margin)))
        : el('span', { class: 'muted' }, 'n/a')),

      countCell(day.split, day.total.imp, 'Impressions', (v) => write(null, { imp: v })),
      countCell(day.split, day.total.clicks, 'Clicks', (v) => write(null, { clicks: v })),

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
        onSpend: (v) => write(p.creative.id, { spend_internal: v }),
        onImp: (v) => write(p.creative.id, { imp: v }),
        onClicks: (v) => write(p.creative.id, { clicks: v }),
      }));
    }
    if (day.loose.spend || day.loose.imp || day.loose.clicks) {
      body.appendChild(creativeRow(m, 'Not attributed to a creative', day.loose, {
        readonly: true,
        note: 'Typed before this line was split. It still counts toward the line total — '
          + 'move it onto a creative from the line drawer if it belongs to one.',
      }));
    }
  }

  return resizable(el('table', { class: 'data' },
    el('thead', {}, el('tr', {},
      el('th', {}, 'Line'),
      el('th', { class: 'num', title: 'Internal spend as paid to the media owner, in the line’s own currency' },
        `Spend · ${dateAu(date)}`),
      el('th', { class: 'num', title: 'The same figure converted to AUD at this campaign’s rate' },
        'Internal AUD'),
      el('th', { class: 'num', title: 'What the client is billed for it — internal ÷ (1 − margin)' },
        'Client AUD'),
      el('th', { class: 'num' }, 'Impressions'),
      el('th', { class: 'num' }, 'Clicks'),
      el('th', { class: 'num', title: 'Total spent on this line across the whole flight' }, 'Spent to date'),
      el('th', { class: 'num', title: 'What the plan’s schedule says should have been spent by today' }, 'Should be'),
      el('th', { class: 'num', title: 'Spent minus scheduled. Negative means the money is still owed to the campaign.' }, 'Variance'),
      el('th', { class: 'num', title: 'Everything not yet spent ÷ days left in the flight — carries an underspend forward' }, 'Run at'),
      el('th', {}, 'What to do'),
      el('th', { class: 'num' }, 'Margin'))),
    body), 'tracking-entry', COLW);
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
  const { readonly, note, onSpend, onImp, onClicks } = opts;
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
          'aria-label': `Spend for ${label}`,
          onchange: (e) => onSpend(Number(e.target.value) || 0),
        })),

    el('td', { class: 'num muted' }, money(figures.spend / m.rate)),
    el('td', { class: 'num muted' }, m.billable
      ? money(grossUp(figures.spend / m.rate, m.margin)) : 'n/a'),

    countCell(readonly, figures.imp, 'Impressions', onImp),
    countCell(readonly, figures.clicks, 'Clicks', onClicks),

    dim(), dim(), dim(), dim(),
    el('td', { class: 'wrap prose muted' }, ''),
    dim());
}

/** Impressions / clicks: an input, or the derived sum when the row is a total. */
function countCell(derived, value, label, onChange) {
  if (derived) {
    return el('td', { class: 'num' },
      el('div', { class: 'derived' }, value ? int(value) : '—'));
  }
  return el('td', { class: 'num' }, el('input', {
    class: 'cellinput', type: 'number', step: '1', value: value || '',
    'aria-label': label,
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
function creativeControl(m, creatives, spends, rerender) {
  const add = (name, adopt) => {
    const id = newId('cr');
    put('creative', { id, line_id: m.line.id, name, live_from: '', status: 'Live' });
    if (adopt) {
      for (const s of spends.filter((x) => !x.creative_id)) {
        put('spend', { ...s, creative_id: id });
      }
    }
    rerender();
  };

  if (!creatives.length) {
    const loose = looseSpendTotal(creatives, spends);
    return el('button', {
      class: 'btn ghost sm splitbtn',
      title: 'Track this line as separate creatives. The line total becomes the sum of them.',
      onclick: () => {
        const name = (prompt('Name of the first creative on this line:', 'Creative A') || '').trim();
        if (!name) return;
        /* Money already typed against the line belongs somewhere. Asking is
           the only honest option: silently adopting it would rewrite history,
           silently stranding it would leave a total nobody can explain. */
        const adopt = loose > 0.005
          ? confirm(`This line already has ${money2(loose, m.ccy)} of spend entered before any creative existed.\n\n`
            + `OK — move it onto “${name}”.\n`
            + 'Cancel — leave it unattributed. It still counts toward the line total and stays visible as its own row.')
          : false;
        add(name, adopt);
      },
    }, '+ Split by creative');
  }

  return el('button', {
    class: 'btn ghost sm splitbtn',
    title: 'Add another creative to this line',
    onclick: () => {
      const name = (prompt('Name of the new creative:', `Creative ${String.fromCharCode(65 + creatives.length)}`) || '').trim();
      if (name) add(name, false);
    },
  }, '+ Creative');
}


