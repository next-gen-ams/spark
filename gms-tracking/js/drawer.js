/* Line drawer — edit a media-plan line, see exactly how its client-facing
   number was derived, and manage its creatives. */

import { el, fill, money, money2, int, pct, monthLabel, toast, selectOrNew, shown } from './dom.js';
import { put, where, newId, vocab, addVocab, fxMap, loadCreativeImages, deleteCascade, deleteCreative } from './store.js';
import { imageField } from './paste-image.js';
import { dialog, confirmDanger, errorLine } from './modal.js';
import { grossUp, num, perAud, effectiveStatus, cumulative} from './calc.js';
import { exportBackup } from './exportxlsx.js';

let host = null;

function mount() {
  if (host) return host;
  host = el('div');
  document.body.appendChild(host);
  return host;
}

export function closeDrawer() { if (host) fill(host); }

export function openLine(m, rerender) {
  const line = { ...m.line };
  const h = fill(mount());
  const refresh = () => { rerender(); openLine({ ...m, line: { ...line } }, rerender); };
  reopen = refresh;

  const save = (patch) => {
    Object.assign(line, patch);
    put('line', { id: line.id, ...patch });
    rerender();
  };

  h.appendChild(el('div', { class: 'scrim', onclick: closeDrawer }));
  h.appendChild(el('aside', { class: 'drawer', role: 'dialog', 'aria-label': 'Line item' },
    el('header', {},
      el('div', { style: { flex: 1 } },
        el('h3', {}, shown(line.platform) || 'Line item',
          shown(line.placement) ? el('span', { class: 'muted' }, ' · ' + shown(line.placement)) : null),
        /* Defensive: a row model built outside model.js may not carry the
           names. Better a thin header than the word "undefined". */
        el('p', {}, [m.clientName, m.campaignName].filter(Boolean).join(' · ') || 'Line item',
          m.campaign.io_number ? ` · ${m.campaign.io_number}` : '')),
      el('button', { class: 'btn ghost', onclick: closeDrawer, 'aria-label': 'Close' }, '✕')),

    el('div', { class: 'content' },
      derivation(m),
      identity(line, save, m.campaign),
      commercials(line, save, m),
      monthly(m),
      creatives(line, refresh, m),
      el('div', { class: 'field' },
        el('label', {}, 'Note'),
        el('textarea', {
          rows: 3, value: line.note || '',
          onchange: (e) => save({ note: e.target.value }),
        }))),

    el('footer', {},
      el('button', { class: 'btn ghost', onclick: () => {
        /* Say what actually goes, counted. "and all of its spend" is a phrase;
           "and the 24 spend entries on it" is a number the user can weigh. */
        const spend = where('spend', (x) => x.line_id === line.id).length;
        const creatives = where('creative', (c) => c.line_id === line.id).length;
        const also = [
          spend ? `${spend} spend ${spend === 1 ? 'entry' : 'entries'}` : null,
          creatives ? `${creatives} creative${creatives === 1 ? '' : 's'}` : null,
        ].filter(Boolean);
        confirmDanger({
          title: 'Delete this line?',
          detail: `${shown(line.supplier) || 'This line'} · ${shown(line.placement) || 'no placement recorded'}`
            + (also.length ? `. This also deletes ${also.join(' and ')}.` : '.'),
          confirmLabel: 'Delete line',
          onBackup: exportBackup,
          onConfirm: () => {
            deleteCascade('line', line.id);
            closeDrawer(); rerender(); toast('Line deleted');
          },
        });
      } }, 'Delete line'),
      el('button', { class: 'btn primary', onclick: closeDrawer }, 'Done'))));

  const esc = (e) => { if (e.key === 'Escape') { closeDrawer(); document.removeEventListener('keydown', esc); } };
  document.addEventListener('keydown', esc);
}

/* ------------------------------------------------------------ derivation */

/** The whole point of the dashboard, spelled out so nobody has to trust it. */
function derivation(m) {
  const rows = [
    ['Internal spend', money2(m.spendCcy, m.ccy)],
    [`÷ FX (1 AUD = ${m.rate} ${m.ccy})`, money2(m.spendInternal)],
    [`÷ (1 − margin ${pct(m.margin, 1)})`, money2(m.clientProrata)],
  ];
  if (m.overspend > 0.5) {
    rows.push(['Booked budget for this line', money2(m.budgetClient)]);
    rows.push(['Over booked budget', money2(m.overspend)]);
  }
  rows.push(['Margin realised', m.effMargin == null ? '—' : pct(m.effMargin, 1)]);

  return el('div', {},
    el('div', { class: 'field' }, el('label', {}, 'How the client number is derived')),
    el('div', { class: 'calcbox' },
      el('dl', {}, ...rows.flatMap(([k, v]) => [
        el('dt', {}, k),
        el('dd', { style: /Over/.test(k) ? { color: 'var(--crit)' } : {} }, v),
      ])),
      el('div', { class: 'formula' },
        'client = internal ÷ FX ÷ (1 − margin)'),
      m.overspend > 0.5
        ? el('div', { class: 'hint', style: { marginTop: '8px', color: 'var(--warn)' } },
          `This line has run ${money2(m.overspend)} past what it booked. A fixed-fee `
          + `contract would cap it at ${money2(m.clientCapped)}; the difference is GMS's `
          + 'to absorb or to raise with the client.')
        : null,
      !m.billable
        ? el('div', { class: 'hint', style: { marginTop: '8px', color: 'var(--ink-3)' } },
          'Non-billable line — excluded from pacing, cost efficiency and the client export.')
        : null));
}

/* --------------------------------------------------------------- fields */

function identity(line, save, campaign) {
  const pick = (kind, key) => selectOrNew(line[key] || '', vocab(kind), (v) => {
    addVocab(kind, v); save({ [key]: v });
  }, { cls: '' });

  /* 'Not started' and 'Live' only describe where the calendar is, so the app
     derives them from the flight and everywhere else shows the derived one.
     The select still edits the stored value — the hint says what actually
     displays, so the two can't silently disagree. */
  const shown = effectiveStatus(line, campaign);
  const stored = line.status || 'Not started';

  return el('div', {},
    el('div', { class: 'row2' },
      el('div', { class: 'field' }, el('label', {}, 'Platform'), pick('platform', 'platform')),
      el('div', { class: 'field' }, el('label', {}, 'Objective'), pick('objective', 'objective'))),
    el('div', { class: 'row3' },
      el('div', { class: 'field' }, el('label', {}, 'Buy method'), pick('buy_method', 'buy_method')),
      el('div', { class: 'field' }, el('label', {}, 'Status'), pick('status', 'status'),
        shown !== stored
          ? el('div', { class: 'hint' },
            `Shows as “${shown}” — automatic from the flight dates. Pick Paused or Stopped to override.`)
          : null),
      el('div', { class: 'field' }, el('label', {}, 'Market'),
        el('input', { value: line.market || '', onchange: (e) => save({ market: e.target.value }) }))),
    el('div', { class: 'row2' },
      el('div', { class: 'field' }, el('label', {}, 'Campaign / placement'),
        el('input', { value: line.placement || '', onchange: (e) => save({ placement: e.target.value }) })),
      el('div', { class: 'field' }, el('label', {}, 'Supplier'),
        el('input', { value: line.supplier || '', onchange: (e) => save({ supplier: e.target.value }) }))));
}

function commercials(line, save, m) {
  const fx = fxMap();
  const ccys = Object.keys(fx);
  return el('div', {},
    el('div', { class: 'row3' },
      el('div', { class: 'field' },
        el('label', {}, 'Spend currency'),
        el('select', { onchange: (e) => save({ currency: e.target.value }) },
          ...ccys.map((c) => el('option', { value: c, selected: c === (line.currency || 'AUD') }, c))),
        el('div', { class: 'hint' }, `1 AUD = ${perAud(line.currency || 'AUD', fx, m.campaign)}`)),
      el('div', { class: 'field' },
        el('label', {}, 'Booked rate — media'),
        el('input', {
          type: 'number', step: '0.01', value: line.rate_media ?? '',
          onchange: (e) => save({ rate_media: e.target.value === '' ? null : Number(e.target.value) }),
        })),
      el('div', { class: 'field' },
        el('label', {}, 'Booked rate — GMS'),
        el('input', {
          type: 'number', step: '0.01', value: line.rate_gms ?? '',
          onchange: (e) => save({ rate_gms: e.target.value === '' ? null : Number(e.target.value) }),
        }))),
    el('div', { class: 'row3' },
      el('div', { class: 'field' },
        el('label', {}, 'Margin %'),
        el('input', {
          type: 'number', step: '0.1', value: line.margin_pct == null ? '' : (line.margin_pct * 100).toFixed(2),
          onchange: (e) => save({ margin_pct: e.target.value === '' ? null : Number(e.target.value) / 100 }),
        }),
        el('div', { class: 'hint' }, 'Pulled from the media plan. Changing it changes every client-facing number on this line.')),
      el('div', { class: 'field' },
        el('label', {}, 'Net media cost (AUD)'),
        el('input', {
          type: 'number', step: '1', value: line.cost_media ?? '',
          onchange: (e) => save({ cost_media: e.target.value === '' ? null : Number(e.target.value) }),
        })),
      el('div', { class: 'field' },
        el('label', {}, 'Net GMS cost (AUD)'),
        el('input', {
          type: 'number', step: '1', value: line.cost_gms ?? '',
          onchange: (e) => save({ cost_gms: e.target.value === '' ? null : Number(e.target.value) }),
        }),
        el('div', { class: 'hint' }, line.cost_media != null && line.margin_pct
          ? `at margin: ${money(grossUp(line.cost_media, line.margin_pct))}` : ''))),
    el('div', { class: 'field' },
      el('label', {},
        el('input', {
          type: 'checkbox', checked: line.billable !== false, style: { width: 'auto', marginRight: '7px' },
          onchange: (e) => save({ billable: e.target.checked }),
        }), 'Billable — include in pacing, cost efficiency and the client report')));
}

/**
 * Monthly bookings, with the two money columns linked through the line's
 * margin. A line's margin does not change from month to month, so letting
 * both figures be typed independently only creates opportunities for them to
 * disagree — and a disagreement here is silently wrong client billing. Type
 * either one and the other follows.
 */
function monthly(m) {
  const rows = where('line_month', (x) => x.line_id === m.line.id)
    .sort((a, b) => a.ym.localeCompare(b.ym));
  if (!rows.length) return el('div');

  const margin = num(m.line.margin_pct);
  const linked = margin > 0 && margin < 1;

  const write = (row, key, value) => {
    const v = value === '' ? null : Number(value);
    const patch = { id: row.id, [key]: v };
    if (linked && v != null) {
      /* Derive the other side rather than leaving it stale. */
      if (key === 'budget_media') patch.budget_gms = round2(v / (1 - margin));
      else patch.budget_media = round2(v * (1 - margin));
    }
    put('line_month', patch);
  };

  return el('div', { class: 'field' },
    el('label', {}, 'Booked by month — from the media plan'),
    el('div', { class: 'hint', style: { marginTop: 0, marginBottom: '7px' } }, linked
      ? `Internal and client are locked together at this line's margin of ${pct(margin, 1)}: type either one and the other follows, so they cannot drift apart.`
      : 'This line has no margin set, so the two columns are independent. Set a margin above to link them.'),
    el('div', { class: 'tablewrap' },
      el('table', { class: 'data' },
        el('thead', {}, el('tr', {},
          el('th', {}, 'Month'), el('th', { class: 'num' }, 'Units'),
          el('th', { class: 'num' }, 'Internal'),
          el('th', { class: 'num' }, linked ? `Client (÷ ${(1 - margin).toFixed(2)})` : 'Client'))),
        el('tbody', {}, ...rows.map((r) => el('tr', {},
          el('td', {}, monthLabel(r.ym)),
          el('td', { class: 'num' }, el('input', {
            class: 'cellinput', type: 'number', step: '1', value: r.units ?? '',
            onchange: (e) => put('line_month', {
              id: r.id, units: e.target.value === '' ? null : Number(e.target.value),
            }),
          })),
          el('td', { class: 'num' }, el('input', {
            class: 'cellinput', type: 'number', step: '1', value: r.budget_media ?? '',
            onchange: (e) => { write(r, 'budget_media', e.target.value); refreshDrawer(); },
          })),
          el('td', { class: 'num' }, el('input', {
            class: 'cellinput', type: 'number', step: '1', value: r.budget_gms ?? '',
            onchange: (e) => { write(r, 'budget_gms', e.target.value); refreshDrawer(); },
          }))))),
        el('tfoot', {}, el('tr', {},
          el('td', {}, 'Total'),
          el('td', { class: 'num' }, int(rows.reduce((a, r) => a + num(r.units), 0) || null)),
          el('td', { class: 'num' }, money(rows.reduce((a, r) => a + num(r.budget_media), 0))),
          el('td', { class: 'num' }, money(rows.reduce((a, r) => a + num(r.budget_gms), 0))))))));
}

const round2 = (n) => Math.round(n * 100) / 100;

/* Re-opening the drawer is how the linked column shows its new value. */
let reopen = null;
function refreshDrawer() { if (reopen) reopen(); }

/* ------------------------------------------------------------- creatives */

/**
 * The thumbnail cell: shows what is stored, or offers to take a paste.
 *
 * Images are not part of the boot read — they are fetched the first time a
 * drawer wants them, so opening the dashboard never pays for pictures nobody
 * asked to see. `undefined` means "not fetched yet", `null` means "fetched,
 * there is none"; the two must stay distinguishable or this re-fetches
 * forever.
 */
function thumbCell(c, refresh) {
  if (c.preview_image === undefined) {
    loadCreativeImages([c.id]).then((changed) => { if (changed) refresh(); });
    return el('span', { class: 'muted', style: { fontSize: '11px' } }, 'loading…');
  }
  if (c.preview_image) {
    return el('div', { class: 'shotprev', style: { maxWidth: '120px' } },
      el('img', { src: c.preview_image, alt: `${c.name || 'Creative'} preview` }),
      el('button', {
        class: 'btn ghost sm', title: 'Remove this screenshot',
        onclick: () => { put('creative', { id: c.id, preview_image: null }); refresh(); },
      }, '✕'));
  }
  return el('button', {
    class: 'btn chip', style: { marginTop: 0 },
    title: 'Paste a screenshot of this creative',
    onclick: () => pasteDialog(c, refresh),
  }, '+ Paste');
}

function pasteDialog(c, refresh) {
  const shot = imageField('Screenshot', {
    hint: 'Click the box then ⌘V. Shrunk to 480px wide before storing.',
  });
  dialog({
    title: `Screenshot — ${c.name || 'creative'}`,
    sub: 'Rides along in the Creative breakdown sheet of the Excel export.',
    content: [shot],
    actions: [
      { label: 'Cancel' },
      {
        label: 'Save', primary: true,
        onClick: () => {
          if (!shot.value()) return false;
          put('creative', { id: c.id, preview_image: shot.value() });
          refresh();
          return undefined;
        },
      },
    ],
  });
}

function creatives(line, refresh, m) {
  const list = where('creative', (c) => c.line_id === line.id);
  const spend = where('spend', (s) => s.line_id === line.id);
  /* Snapshots: a creative's figure is its latest one, not the sum of them. */
  const spendOf = (cid) => cumulative(spend.filter((s) => s.creative_id === cid)).spend;

  const body = el('tbody', {}, ...list.map((c) => el('tr', {},
    el('td', { class: 'wrap' }, el('input', {
      class: 'cellinput', style: { textAlign: 'left' }, value: c.name || '',
      onchange: (e) => put('creative', { id: c.id, name: e.target.value }),
    })),
    el('td', {}, el('input', {
      class: 'cellinput', type: 'date', value: c.live_from || m.campaign.start_date || '',
      onchange: (e) => put('creative', { id: c.id, live_from: e.target.value }),
    })),
    el('td', {}, el('input', {
      class: 'cellinput', type: 'date', value: c.live_to || m.campaign.end_date || '',
      onchange: (e) => put('creative', { id: c.id, live_to: e.target.value }),
    })),
    el('td', { class: 'num' }, el('input', {
      class: 'cellinput', type: 'number', min: '0', step: '0.01',
      value: c.target_budget ?? '',
      onchange: (e) => put('creative', {
        id: c.id, target_budget: e.target.value === '' ? null : Number(e.target.value),
      }),
    })),
    el('td', { class: 'num' }, money(spendOf(c.id), line.currency || 'AUD', 0)),
    el('td', {}, el('input', {
      class: 'cellinput', style: { textAlign: 'left' }, placeholder: 'preview link',
      value: c.preview_url || '',
      onchange: (e) => put('creative', { id: c.id, preview_url: e.target.value }),
    })),
    el('td', {}, thumbCell(c, refresh)),
    el('td', {}, el('button', {
      class: 'btn ghost sm', title: 'Remove creative',
      onclick: () => {
        const owned = where('spend', (x) => x.creative_id === c.id).length;
        const impact = spendOf(c.id);
        dialog({
          title: `Delete ${c.name || 'this creative'}?`,
          sub: owned
            ? `This permanently deletes ${owned} cumulative ${owned === 1 ? 'snapshot' : 'snapshots'}. `
              + `The line and campaign totals will decrease by ${money(impact, line.currency || 'AUD', 0)}.`
            : 'This creative has no tracked snapshots yet.',
          content: [el('p', { class: 'hint' },
            'If it has simply finished running, set its end date instead so historical spend stays in the totals.')],
          actions: [
            { label: 'Cancel' },
            { label: 'Delete creative and data', danger: true, onClick: () => { deleteCreative(c.id); refresh(); } },
          ],
        });
      },
    }, '✕')))));

  return el('div', { class: 'field' },
    el('label', {}, `Creatives — optional (${list.length})`),
    creativeAllocation(line, list, m),
    list.length
      ? el('div', { class: 'tablewrap' }, el('table', { class: 'data' },
        el('thead', {}, el('tr', {},
          el('th', {}, 'Creative'), el('th', {}, 'Start'), el('th', {}, 'End'),
          el('th', { class: 'num' }, `Target · ${line.currency || 'AUD'}`),
          el('th', { class: 'num' }, 'Spend'), el('th', {}, 'Preview'),
          el('th', {}, 'Screenshot'), el('th', {}))),
        body))
      : el('div', { class: 'hint' }, 'No creatives on this line. Line-level spend is tracked either way; add creatives only when you want the breakdown.'),
    el('button', {
      class: 'btn sm', style: { marginTop: '8px' },
      onclick: () => addCreativeDialog(line, m, refresh),
    }, '+ Add creative'));
}

function addCreativeDialog(line, m, refresh) {
  const name = el('input', { value: 'New creative', placeholder: 'Creative name' });
  const from = el('input', { type: 'date', value: m.campaign.start_date || '' });
  const to = el('input', { type: 'date', value: m.campaign.end_date || '' });
  const target = el('input', { type: 'number', min: '0', step: '0.01', placeholder: '0' });
  const err = errorLine();
  dialog({
    title: 'Add a creative',
    sub: 'Dates decide when it appears in Tracking Entry. Target budget drives its evenly paced monthly progress.',
    content: [
      el('div', { class: 'field' }, el('label', {}, 'Creative name'), name),
      el('div', { class: 'row2' },
        el('div', { class: 'field' }, el('label', {}, 'Start date'), from),
        el('div', { class: 'field' }, el('label', {}, 'End date'), to)),
      el('div', { class: 'field' }, el('label', {}, `Target budget · ${line.currency || 'AUD'}`), target),
      err,
    ],
    actions: [
      { label: 'Cancel' },
      { label: 'Add creative', primary: true, onClick: () => {
        const creativeName = name.value.trim();
        if (!creativeName) { err.say('Give the creative a name.'); return false; }
        if (!from.value || !to.value) { err.say('Set both the start and end date.'); return false; }
        if (from.value > to.value) { err.say('The end date must be on or after the start date.'); return false; }
        if ((m.campaign.start_date && from.value < m.campaign.start_date)
          || (m.campaign.end_date && to.value > m.campaign.end_date)) {
          err.say('Keep the creative dates inside the campaign flight.'); return false;
        }
        const budget = Number(target.value);
        if (!(budget > 0)) { err.say(`Set a target budget in ${line.currency || 'AUD'}.`); return false; }
        put('creative', {
          id: newId('cr'), line_id: line.id, name: creativeName,
          live_from: from.value, live_to: to.value,
          target_budget: budget, status: 'Live',
        });
        refresh();
        return undefined;
      } },
    ],
  });
  setTimeout(() => name.select(), 30);
}

function creativeAllocation(line, list, m) {
  if (!list.length) return null;
  const lineBudget = Number(line.cost_media || 0) * m.rate;
  if (!lineBudget) return null;
  const allocated = list.reduce((a, c) => a + Number(c.target_budget || 0), 0);
  const gap = lineBudget - allocated;
  const text = Math.abs(gap) < 1
    ? `Allocated creative budgets match the ${money(lineBudget, line.currency || 'AUD', 0)} line budget.`
    : `${money(Math.abs(gap), line.currency || 'AUD', 0)} ${gap < 0 ? 'over allocated' : 'unallocated'} across creatives. This is a warning only; saving is not blocked.`;
  return el('div', {
    class: `hint allocation ${Math.abs(gap) < 1 ? 'ok' : gap < 0 ? 'over' : 'under'}`,
    style: { marginTop: 0, marginBottom: '7px' },
  }, text);
}
