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

import { el, money, int, pct, monthLabel, dateAu } from './dom.js';
import { put, where, byId, fxMap } from './store.js';
import { monthBounds, num, grossUp, repace, repaceAdvice, todayIso } from './calc.js';
import { resizable } from './resizable.js';

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
        min: bounds ? bounds.start : null, max: bounds ? bounds.end : null,
        onchange: (e) => { state.spendDate = e.target.value; rerender(); },
      }) : null),
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
    for (const tgt of spendTargets(m)) {
      /* Exactly one row per line per day — no aggregation to unpick. */
      const existing = byId('spend', spendId(m.line.id, tgt.creativeId, date));
      const cell = num(existing?.spend_internal);
      const impT = num(existing?.imp);
      const clkT = num(existing?.clicks);

      const write = (patch) => {
        put('spend', {
          id: spendId(m.line.id, tgt.creativeId, date),
          line_id: m.line.id, creative_id: tgt.creativeId || null, date, ...patch,
        });
        rerender();
      };

      /* Pacing belongs to the whole line, so it reads every month and every
         spend row — not the single cell being typed into. */
      const r = repace(m.line, m.campaign,
        where('line_month', (x) => x.line_id === m.line.id),
        where('spend', (x) => x.line_id === m.line.id),
        { fx, today, side });
      const advice = repaceAdvice(r);

      body.appendChild(el('tr', { class: m.billable ? '' : 'nb' },
        el('td', { class: 'wrap' }, m.clientName,
          el('div', { class: 'muted', style: { fontSize: '11px' } },
            `${m.line.platform || '—'} · ${tgt.label}`)),

        el('td', { class: 'num' },
          el('input', {
            class: 'cellinput', type: 'number', step: '0.01', value: cell || '',
            placeholder: '0', 'aria-label': `Spend for ${tgt.label}`,
            onchange: (e) => write({ spend_internal: Number(e.target.value) || 0 }),
          }),
          el('div', { class: 'muted', style: { fontSize: '11px', paddingRight: '7px' } }, m.ccy)),

        /* (2) the two derived figures, back where they were asked for: this is
           where you see the margin actually doing something. */
        el('td', { class: 'num muted' }, money(cell / m.rate)),
        el('td', { class: 'num' }, m.billable
          ? el('b', {}, money(grossUp(cell / m.rate, m.margin)))
          : el('span', { class: 'muted' }, 'n/a')),

        el('td', { class: 'num' }, el('input', {
          class: 'cellinput', type: 'number', step: '1', value: impT || '',
          'aria-label': 'Impressions',
          onchange: (e) => write({ imp: Number(e.target.value) || null }),
        })),
        el('td', { class: 'num' }, el('input', {
          class: 'cellinput', type: 'number', step: '1', value: clkT || '',
          'aria-label': 'Clicks',
          onchange: (e) => write({ clicks: Number(e.target.value) || null }),
        })),

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
    body), 'tracking-entry');
}

function varianceCell(r) {
  if (Math.abs(r.variance) < 1) return el('span', { class: 'tag good' }, 'on plan');
  const behind = r.variance < 0;
  const severity = Math.abs(r.variance) / Math.max(r.due, 1) > 0.25 ? 'crit' : 'warn';
  return el('span', { class: 'tag ' + severity },
    `${behind ? '−' : '+'}${money(Math.abs(r.variance))}`);
}

/** A line with creatives is entered per creative; otherwise at line level. */
function spendTargets(m) {
  const crs = where('creative', (c) => c.line_id === m.line.id);
  const label = m.line.placement || m.line.supplier || m.line.objective || 'Line';
  if (!crs.length) return [{ creativeId: null, label }];
  return crs.map((c) => ({ creativeId: c.id, label: c.name || 'Creative' }));
}


