import { el, money, pct, tip, monthLabel } from './dom.js';
import { all, byId, fxMap, put } from './store.js';
import { monthBounds, num, periodSpend, toAud, todayIso } from './calc.js';

const workingBudget = (row) => row?.budget_working_media == null
  ? num(row?.budget_media)
  : num(row.budget_working_media);

function lineName(line) {
  return line.placement || line.objective || line.platform || 'Line item';
}

function actualForMonth(line, campaign, ym, fx, spends) {
  const bounds = monthBounds(ym);
  const local = periodSpend(spends, bounds.start, bounds.end).spend;
  return toAud(local, line.currency || 'AUD', fx, campaign);
}

function campaignModel(campaign) {
  const fx = fxMap();
  const lines = all('line')
    .filter((line) => line.campaign_id === campaign.id)
    .sort((a, b) => num(a.seq) - num(b.seq));
  const lineIds = new Set(lines.map((line) => line.id));
  const monthRows = all('line_month').filter((row) => lineIds.has(row.line_id));
  const monthKeys = [...new Set(monthRows.map((row) => row.ym).filter(Boolean))].sort();
  const rowsByLine = new Map();
  const spendsByLine = new Map();
  monthRows.forEach((row) => {
    if (!rowsByLine.has(row.line_id)) rowsByLine.set(row.line_id, new Map());
    rowsByLine.get(row.line_id).set(row.ym, row);
  });
  all('spend').forEach((row) => {
    if (!lineIds.has(row.line_id)) return;
    if (!spendsByLine.has(row.line_id)) spendsByLine.set(row.line_id, []);
    spendsByLine.get(row.line_id).push(row);
  });

  const todayYm = todayIso().slice(0, 7);
  const currentYm = monthKeys.includes(todayYm)
    ? todayYm
    : monthKeys.filter((ym) => ym <= todayYm).at(-1) || monthKeys[0] || todayYm;

  const lineModels = lines.map((line) => {
    let cumulativeBooked = 0;
    let cumulativeBudgeted = 0;
    let cumulativeActual = 0;
    const months = monthKeys.map((ym) => {
      const row = rowsByLine.get(line.id)?.get(ym);
      const booked = num(row?.budget_media);
      const budgeted = workingBudget(row);
      const actual = actualForMonth(line, campaign, ym, fx, spendsByLine.get(line.id) || []);
      cumulativeBooked += booked;
      cumulativeBudgeted += budgeted;
      cumulativeActual += actual;
      return {
        ym, row, lineId: line.id, booked, budgeted, actual,
        cumulativeBooked, cumulativeBudgeted, cumulativeActual,
      };
    });
    return { line, months };
  });

  let cumulativeBooked = 0;
  let cumulativeBudgeted = 0;
  let cumulativeActual = 0;
  const months = monthKeys.map((ym) => {
    const values = lineModels.map((line) => line.months.find((month) => month.ym === ym));
    const month = {
      ym,
      booked: values.reduce((sum, month) => sum + num(month?.booked), 0),
      budgeted: values.reduce((sum, month) => sum + num(month?.budgeted), 0),
      actual: values.reduce((sum, month) => sum + num(month?.actual), 0),
    };
    cumulativeBooked += month.booked;
    cumulativeBudgeted += month.budgeted;
    cumulativeActual += month.actual;
    return { ...month, cumulativeBooked, cumulativeBudgeted, cumulativeActual };
  });
  const totals = months.reduce((out, month) => ({
    booked: out.booked + month.booked,
    budgeted: out.budgeted + month.budgeted,
    actual: out.actual + month.actual,
  }), { booked: 0, budgeted: 0, actual: 0 });

  return { lines: lineModels, months, totals, currentYm };
}

function monthlyFilters(campaigns, selected, state, rerender) {
  const clients = all('client').slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const clientPicker = el('label', { class: 'monthly-client-picker' },
    el('span', {}, 'Client'),
    el('select', {
      'aria-label': 'Client', 'data-focus': 'monthly-client',
      onchange: event => {
        state.filters.client = event.target.value;
        const available = all('campaign')
          .filter(campaign => !state.filters.client || campaign.client_id === state.filters.client)
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        state.filters.campaign = available.find(campaign => campaign.id === selected?.id)?.id
          || available[0]?.id || '';
        rerender();
      },
    }, el('option', { value: '', selected: !state.filters.client }, 'All clients'),
    ...clients.map(client => el('option', {
      value: client.id, selected: client.id === state.filters.client,
    }, client.name || 'Untitled client'))));
  const campaignPicker = el('label', { class: 'monthly-campaign-picker' },
    el('span', {}, 'Campaign'),
    el('select', {
      'aria-label': 'Campaign', 'data-focus': 'monthly-campaign', disabled: !campaigns.length,
      onchange: event => {
        state.filters.campaign = event.target.value;
        rerender();
      },
    }, campaigns.length ? campaigns.map(campaign => {
      const client = byId('client', campaign.client_id);
      return el('option', {
        value: campaign.id, selected: campaign.id === selected?.id,
      }, state.filters.client ? campaign.name || 'Untitled campaign'
        : `${client?.name || 'Client'} · ${campaign.name || 'Untitled campaign'}`);
    }) : el('option', { value: '' }, 'No campaigns')));
  return el('div', { class: 'monthly-filter-pair' }, clientPicker, campaignPicker);
}

function totalsStrip(model) {
  const current = model.months.find((month) => month.ym === model.currentYm) || model.months.at(-1);
  const position = current ? current.cumulativeActual - current.cumulativeBudgeted : 0;
  const positionText = !current ? 'No allocation'
    : Math.abs(position) < 0.5 ? 'On plan'
      : `${money(Math.abs(position))} ${position > 0 ? 'over' : 'under'}`;
  return el('div', { class: 'monthly-totals' },
    metric('Booked', money(model.totals.booked), 'Original imported media plan'),
    metric('Budgeted', money(model.totals.budgeted), 'Current editable working allocation'),
    metric('Actual', money(model.totals.actual), 'Recorded spend converted to internal AUD'),
    metric('Current position', positionText,
      `Cumulative actual minus cumulative budget through ${current ? monthLabel(current.ym) : 'the current month'}`));
}

function metric(label, value, help) {
  return el('div', {},
    el('span', {}, label, tip(help, `${label} definition`)),
    el('b', {}, value));
}

function monthlyChart(model) {
  const max = Math.max(1, ...model.months.flatMap((month) =>
    [month.cumulativeBooked, month.cumulativeBudgeted, month.cumulativeActual]));
  const bar = (kind, value) => el('i', {
    class: kind,
    style: { height: `${Math.max(value > 0 ? 2 : 0, value / max * 100)}%` },
  });
  return el('div', { class: 'monthly-chart-wrap' },
    el('div', { class: 'monthly-legend' },
      el('span', {}, el('i', { class: 'booked' }), 'Cumulative booked'),
      el('span', {}, el('i', { class: 'budgeted' }), 'Cumulative budgeted'),
      el('span', {}, el('i', { class: 'actual' }), 'Cumulative actual')),
    el('div', { class: 'monthly-chart-v2', role: 'img', 'aria-label': 'Cumulative booked, budgeted and actual through each month' },
      ...model.months.map((month) => el('div', {
        class: `monthly-chart-month${month.ym === model.currentYm ? ' current' : ''}`,
        title: `${monthLabel(month.ym)}: cumulative booked ${money(month.cumulativeBooked)}, budgeted ${money(month.cumulativeBudgeted)}, actual ${money(month.cumulativeActual)}`,
      },
        el('div', { class: 'monthly-bars' },
          bar('booked', month.cumulativeBooked),
          bar('budgeted', month.cumulativeBudgeted),
          bar('actual', month.cumulativeActual)),
        el('b', {}, monthLabel(month.ym).slice(0, 3)),
        month.ym === model.currentYm
          ? el('small', { class: 'monthly-current-label' }, 'Current') : null))));
}

function lineCard(model, currentYm, rerender) {
  const totals = model.months.reduce((out, month) => ({
    booked: out.booked + month.booked,
    budgeted: out.budgeted + month.budgeted,
    actual: out.actual + month.actual,
  }), { booked: 0, budgeted: 0, actual: 0 });
  const changed = model.months.some((month) => Math.abs(month.budgeted - month.booked) > 0.005);

  return el('details', { class: 'monthly-line-card' },
    el('summary', {},
      el('div', { class: 'monthly-line-name' },
        el('span', { class: 'tag' }, model.line.platform || 'Other'),
        el('b', {}, lineName(model.line)),
        changed ? el('small', { class: 'monthly-edited' }, 'Budget adjusted') : null),
      summaryMetric('Booked', totals.booked),
      summaryMetric('Budgeted', totals.budgeted),
      summaryMetric('Actual', totals.actual)),
    el('div', { class: 'monthly-line-body' },
      el('div', { class: 'tablewrap' },
        el('table', { class: 'data monthly-table' },
          el('thead', {}, el('tr', {},
            el('th', {}, 'Month'),
            el('th', { class: 'num' }, 'Booked'),
            el('th', { class: 'num' }, 'Budgeted'),
            el('th', { class: 'num' }, 'Actual this month'),
            el('th', {}, 'Cumulative position',
              tip('Compares all actual spend through this month with all working budget through this month.')))),
          el('tbody', {}, ...model.months.map((month) => monthRow(month, currentYm, rerender))))),
      changed ? el('button', {
        class: 'btn sm ghost',
        onclick: () => {
          model.months.forEach((month) => {
            if (!month.row || month.row.budget_working_media == null) return;
            put('line_month', { ...month.row, budget_working_media: null });
          });
          rerender();
        },
      }, 'Reset this line to booked') : null));
}

function summaryMetric(label, value) {
  return el('span', { class: 'monthly-line-summary' },
    el('small', {}, label), el('b', {}, money(value)));
}

function monthRow(month, currentYm, rerender) {
  const difference = month.cumulativeActual - month.cumulativeBudgeted;
  const position = month.cumulativeBudgeted > 0
    ? month.ym < currentYm
      ? `${pct(month.cumulativeActual / month.cumulativeBudgeted, 0)} used`
      : month.ym === currentYm
        ? Math.abs(difference) < 0.5 ? 'On plan'
          : `${money(Math.abs(difference))} ${difference > 0 ? 'over' : 'under'}`
        : 'Upcoming'
    : month.cumulativeActual > 0 ? `${money(month.cumulativeActual)} unbudgeted` : 'No allocation';
  const edited = Math.abs(month.budgeted - month.booked) > 0.005;
  const input = el('input', {
    type: 'number', min: '0', step: '0.01', inputmode: 'decimal',
    value: month.budgeted.toFixed(2),
    'aria-label': `${monthLabel(month.ym)} working budget`,
    onchange: (event) => {
      const value = Math.max(0, num(event.target.value));
      put('line_month', {
        ...(month.row || {
          id: `${month.lineId}|${month.ym}`,
          line_id: month.lineId,
          ym: month.ym,
          units: 0,
          budget_media: 0,
          budget_gms: 0,
        }),
        budget_working_media: Math.abs(value - month.booked) > 0.005 ? value : null,
      });
      rerender();
    },
    onkeydown: (event) => { if (event.key === 'Enter') event.currentTarget.blur(); },
  });
  return el('tr', { class: `${edited ? 'budget-edited ' : ''}${month.ym === currentYm ? 'current-month' : ''}`.trim() },
    el('td', {}, monthLabel(month.ym)),
    el('td', { class: 'num' }, money(month.booked)),
    el('td', { class: 'num monthly-budget-cell' }, input),
    el('td', { class: 'num' }, money(month.actual)),
    el('td', {
      class: month.ym === currentYm && difference > 0 ? 'monthly-over' : '',
      title: `Cumulative budgeted ${money(month.cumulativeBudgeted)}, cumulative actual ${money(month.cumulativeActual)}`,
    }, position));
}

export function renderMonthly(host, { state, rerender }) {
  const campaigns = all('campaign')
    .filter((campaign) => !state.filters.client || campaign.client_id === state.filters.client)
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const selected = campaigns.find(campaign => campaign.id === state.filters.campaign) || campaigns[0];
  const section = el('section', { class: 'monthly-page-v2' },
    el('div', { class: 'monthly-page-head' },
      el('div', {},
        el('span', { class: 'eyebrow' }, 'Monthly pacing'),
        el('h2', {}, selected?.name || 'Monthly pacing',
          tip('Every line is collapsed by default. Open only the line whose monthly working budget needs changing.'))),
      monthlyFilters(campaigns, selected, state, rerender)));
  host.appendChild(section);
  if (!selected) {
    section.appendChild(el('div', { class: 'empty' },
      el('strong', {}, state.filters.client ? 'No campaigns for this client' : 'No campaigns yet'),
      el('div', {}, state.filters.client
        ? 'Choose another client or import a media plan for this client.'
        : 'Import a media plan before setting monthly working budgets.')));
    return;
  }
  const model = campaignModel(selected);
  section.append(totalsStrip(model), monthlyChart(model),
    el('div', { class: 'monthly-lines-head' },
      el('h3', {}, 'Line items'),
      tip('Booked comes from the imported plan. Budgeted is editable and shared. Actual is derived from cumulative snapshots.')),
    el('div', { class: 'monthly-line-list' },
      ...model.lines.map(line => lineCard(line, model.currentYm, rerender))));
}
