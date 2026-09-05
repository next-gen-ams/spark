/* Line drawer — edit a media-plan line, see exactly how its client-facing
   number was derived, and manage its creatives. */

import { el, fill, money, money2, int, pct, monthLabel, toast, selectOrNew, shown, tip } from './dom.js';
import { put, where, byId, newId, vocab, addVocab, fxMap, loadCreativeImages, deleteCascade, deleteCreative } from './store.js';
import { imageField } from './paste-image.js';
import { dialog, confirmDanger, errorLine } from './modal.js';
import { grossUp, num, perAud, effectiveStatus, cumulative, lineMetrics } from './calc.js';
import { exportBackup } from './exportxlsx.js';

let host = null;

function mount() {
  if (host) return host;
  host = el('div');
  document.body.appendChild(host);
  return host;
}

let requestClose = null;
export function closeDrawer() { if (requestClose) requestClose(); else if (host) fill(host); }

export function openLine(m, rerender) {
  const returnFocus = document.activeElement;
  let line = { ...m.line }, active = 'overview', editing = false;
  let draft = null, monthDrafts = [], pendingMonths = new Map();
  let closed = false;
  const h = fill(mount());
  const currentModel = () => {
    line = { ...(byId('line', line.id) || line) };
    return { ...m, ...lineMetrics(line, m.campaign,
      where('line_month', row => row.line_id === line.id),
      where('spend', row => row.line_id === line.id), { fx: fxMap() }) };
  };
  const finish = () => {
    closed = true; requestClose = null; fill(h);
    document.removeEventListener('keydown', onKey);
    if (returnFocus?.isConnected) returnFocus.focus();
  };
  const dirty = () => editing && (active === 'monthly' ? pendingMonths.size > 0
    : Object.keys(draft).some(key => draft[key] !== line[key]));
  requestClose = () => {
    if (!dirty()) return finish();
    dialog({ title: 'Discard unsaved changes?',
      sub: 'Your saved settings and budgets will stay unchanged.',
      actions: [{ label: 'Keep editing' }, { label: 'Discard changes', onClick: finish }] });
  };
  const refresh = () => { if (!closed && !editing) { rerender(); render(); } };
  const startEdit = () => {
    editing = true; draft = { ...line }; pendingMonths = new Map();
    monthDrafts = where('line_month', row => row.line_id === line.id)
      .sort((a, b) => a.ym.localeCompare(b.ym)).map(row => ({ ...row }));
    render(); h.querySelector('.content input, .content select')?.focus();
  };
  const saveChanges = () => {
    const invalid = [...h.querySelectorAll('.content input[data-edited]')].find(input => !input.checkValidity());
    if (invalid) { invalid.reportValidity(); return; }
    if (active === 'monthly') {
      for (const patch of pendingMonths.values()) put('line_month', patch);
    } else {
      const patch = Object.fromEntries(Object.entries(draft).filter(([key, value]) => value !== line[key]));
      if (Object.keys(patch).length) put('line', { id: line.id, ...patch });
      for (const key of ['platform', 'objective', 'buy_method', 'status']) {
        if (patch[key]) addVocab(key, patch[key]);
      }
    }
    editing = false; rerender(); render(); toast('Changes saved');
  };
  const row = (label, value) => el('div', { class: 'line-detail-row' },
    el('span', {}, label), el('b', {}, value == null || value === '' ? '—' : value));
  const heading = (label, editLabel) => el('div', { class: 'line-detail-heading' },
    el('h4', {}, label), editLabel && !editing ? el('button', { class: 'btn ghost sm', onclick: startEdit }, editLabel) : null);
  const detail = (label, ...content) => el('details', { class: 'line-detail-disclosure' }, el('summary', {}, label), ...content);
  const deleteButton = () => el('button', { class: 'btn ghost danger', onclick: () => {
        const spend = where('spend', (x) => x.line_id === line.id).length;
        const creativeCount = where('creative', (c) => c.line_id === line.id).length;
        const also = [
          spend ? `${spend} spend ${spend === 1 ? 'entry' : 'entries'}` : null,
          creativeCount ? `${creativeCount} creative${creativeCount === 1 ? '' : 's'}` : null,
        ].filter(Boolean);
        confirmDanger({
          title: 'Delete this line?',
          detail: `${shown(line.supplier) || 'This line'} · ${shown(line.placement) || 'no placement recorded'}`
            + (also.length ? `. This also deletes ${also.join(' and ')}.` : '.'),
          confirmLabel: 'Delete line',
          onBackup: exportBackup,
          onConfirm: () => {
            deleteCascade('line', line.id);
            finish(); rerender(); toast('Line deleted');
          },
        });
      } }, 'Delete line');

  const monthlyPanel = (model) => {
    const rows = editing ? monthDrafts : where('line_month', item => item.line_id === line.id).sort((a,b) => a.ym.localeCompare(b.ym));
    const linked = model.margin > 0 && model.margin < 1;
    const table = el('table', { class: 'data monthly-booking-table line-detail-budget' });
    const totals = el('tfoot');
    const updateTotals = () => fill(totals, el('tr', {}, el('td', {}, 'Total'),
      ...['budget_media', 'budget_gms'].map(key => el('td', { class: 'num' }, money2(rows.reduce((sum,r) => sum + num(r[key]), 0))))));
    const write = (r, key, input) => {
      const value = input.value === '' ? null : Number(input.value);
      if (value != null && !Number.isFinite(value)) return;
      const patch = { ...(pendingMonths.get(r.id) || { id: r.id }), [key]: value };
      if (linked && value != null && key !== 'units') {
        const other = key === 'budget_media' ? 'budget_gms' : 'budget_media';
        patch[other] = round2(key === 'budget_media' ? value / (1 - model.margin) : value * (1 - model.margin));
        const peer = input.closest('tr').querySelector(`[data-budget-key="${other}"]`);
        if (peer) peer.value = editableNumber(patch[other]);
      }
      Object.assign(r, patch); pendingMonths.set(r.id, patch); updateTotals();
    };
    const numberInput = (r,key) => {
      const input = el('input', { class: 'cellinput', type: 'number', step: '0.01', inputmode: 'decimal',
        'data-budget-key': key, 'aria-label': `${monthLabel(r.ym)} ${key === 'units' ? 'units' : key === 'budget_media' ? 'internal budget' : 'client budget'}`,
        value: editableNumber(r[key]), oninput: e => write(r,key,e.target) });
      return input;
    };
    fill(table, el('thead', {}, el('tr', {}, el('th', {}, 'Month'), el('th', {class:'num'}, 'Internal'), el('th', {class:'num'}, 'Client'))),
      el('tbody', {}, ...rows.map(r => el('tr', {}, el('td', {}, monthLabel(r.ym)),
        ...['budget_media', 'budget_gms'].map(key => el('td', {class:'num'}, editing ? numberInput(r,key) : money2(r[key])))))), totals);
    updateTotals();
    return el('section', {}, heading('Monthly budget · AUD', rows.length ? 'Edit budget' : null),
      rows.length ? el('div', {class:'tablewrap'}, table) : el('p', {class:'hint'}, 'No monthly bookings on this line.'),
      el('p', {class:'hint'}, linked ? `When editing, internal and client budgets are linked at a ${pct(model.margin,1)} margin. Change either amount and the other follows.` : 'No linked margin is set. Internal and client budgets are independent.'),
      rows.length ? detail('Show booked units', el('table', {class:'data line-detail-units'}, el('tbody', {}, ...rows.map(r => el('tr', {},
        el('td', {}, monthLabel(r.ym)), el('td', {class:'num'}, editing ? numberInput(r,'units') : int(r.units))))))) : null);
  };

  function render() {
    const model = currentModel();
    const content = el('div', { class: 'content', role: 'tabpanel', id: 'line-detail-panel', 'aria-labelledby': `line-detail-${active}` });
    if (active === 'overview') {
      fill(content, el('h4', {}, 'Spend to date'),
        el('div', {class:'line-detail-numbers'},
          el('div', {}, el('span', {}, 'Client spend'), el('b', {}, model.billable ? money2(model.clientProrata) : '—'), el('small', {}, 'AUD')),
          el('div', {}, el('span', {}, 'Internal spend'), el('b', {}, money2(model.spendInternal)), el('small', {}, 'AUD'))),
        !model.billable ? el('p',{class:'hint'},'Non-billable — excluded from client reports and pacing.') : null,
        model.overspend > .5 ? el('p',{class:'line-detail-warning'},`Client spend is ${money2(model.overspend)} over the booked budget.`) : null,
        detail('How is client spend calculated?', derivation(model)),
        el('section', {class:'line-detail-section'}, el('h4', {}, 'Booked budget · AUD'),
          row('Internal budget', money2(model.budgetInternal)), row('Client budget',money2(model.budgetClient)), row('Booked margin',pct(model.margin,1))),
        el('section', {class:'line-detail-section'}, el('div',{class:'line-detail-heading'},el('h4',{},'Delivery details'),
          el('button',{class:'btn ghost sm',onclick:()=>{active='settings';startEdit();}},'Edit details')),
          row('Objective',line.objective),row('Buy method',line.buy_method),row('Status',effectiveStatus(line,m.campaign)),row('Supplier',line.supplier)),
        line.note ? el('section',{class:'line-detail-section'},el('h4',{},'Note'),el('p',{class:'line-detail-note'},line.note)) : null);
    } else if (active === 'monthly') fill(content,monthlyPanel(model));
    else if (active === 'creatives') {
      fill(content, creatives(line,refresh,model),
        el('p',{class:'hint'},'Creative changes save automatically.'));
    }
    else if (editing) {
      const stage = patch => Object.assign(draft,patch);
      fill(content,heading('Line settings'),identity(draft,stage,m.campaign),
        el('section',{class:'line-detail-section'},el('h4',{},'Pricing & currency'),commercials(draft,stage,model)),
        el('div',{class:'field'},el('label',{},'Note'),el('textarea',{rows:3,value:draft.note||'',oninput:e=>stage({note:e.target.value})})));
    } else {
      fill(content,heading('Line settings','Edit settings'),
        ...[['Platform',line.platform],['Objective',line.objective],['Placement',line.placement],['Buy method',line.buy_method],['Supplier',line.supplier],['Market',line.market],['Status',effectiveStatus(line,m.campaign)]].map(([k,v])=>row(k,v)),
        detail('Pricing & currency',row('Spend currency',`${model.ccy} · 1 AUD = ${model.rate}`),row('Booked rate · media',line.rate_media),row('Booked rate · GMS',line.rate_gms),row('Margin',pct(model.margin,1)),row('Net media cost (AUD)',money2(line.cost_media)),row('Net GMS cost (AUD)',money2(line.cost_gms))),
        row('Included in client reports',model.billable?'Yes':'No'),row('IO number',m.campaign.io_number),
        detail('Note',el('p',{class:'line-detail-note'},line.note||'No note yet.')),
        el('div',{class:'line-detail-section'},deleteButton()));
    }
    for (const input of content.querySelectorAll('input')) {
      input.addEventListener('input', () => { input.dataset.edited = 'true'; });
    }
    fill(h,el('div',{class:'scrim',onclick:closeDrawer}),
      el('aside',{class:'drawer line-detail-drawer',role:'dialog','aria-modal':'true','aria-label':'Line item'},
        el('header',{},el('div',{class:'line-detail-title'},
          el('h3',{},m.clientName||'Client'),el('p',{class:'line-detail-placement'},[shown(line.platform),shown(line.placement)].filter(Boolean).join(' · ')||'Line item'),
          el('p',{},m.campaignName||m.campaign.name||'Campaign')),
          el('button',{class:'btn ghost','aria-label':'Close',onclick:closeDrawer},'✕')),
        el('nav',{class:'line-detail-tabs',role:'tablist','aria-label':'Line detail'},...[
          ['overview','Overview'],['monthly','Monthly budget'],['creatives','Creatives'],['settings','Settings']
        ].map(([key,label])=>el('button',{id:`line-detail-${key}`,role:'tab','aria-controls':'line-detail-panel','aria-selected':active===key,disabled:editing,
          onclick:()=>{active=key;render();h.querySelector(`#line-detail-${key}`)?.focus();}},label))),content,
        el('footer',{},el('small',{'aria-live':'polite'},editing?'Unsaved changes':''),
          editing ? el('button',{class:'btn',onclick:()=>{editing=false;render();}},'Cancel') : null,
          el('button',{class:'btn primary',onclick:editing?saveChanges:closeDrawer},editing?'Save changes':'Done'))));
  }
  function onKey(event) {
    if (document.querySelector('.dialogbox, .confirmbox')) return;
    if (event.key === 'Escape') { event.preventDefault(); closeDrawer(); }
    if (event.key === 'Tab') {
      const nodes=[...h.querySelectorAll('button:not(:disabled), input, select, textarea, summary, a[href]')].filter(node=>node.getClientRects().length);
      const first=nodes[0],last=nodes.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
  }
  render(); h.querySelector('header button')?.focus(); document.addEventListener('keydown',onKey);
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
  const pick = (kind, key) => {
    const select = selectOrNew(line[key] || '', vocab(kind), (value) => {
      if (![...select.options].some(option => option.value === value)) select.appendChild(el('option', {value}, value));
      select.value = value;
      save({ [key]: value });
    }, { cls: '' });
    return select;
  };

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
          ? tip(`Shows as “${shown}” — automatic from the flight dates. Pick Paused or Stopped to override.`, 'Automatic status')
          : null),
      el('div', { class: 'field' }, el('label', {}, 'Market'),
        el('input', { value: line.market || '', oninput: (e) => save({ market: e.target.value }) }))),
    el('div', { class: 'row2' },
      el('div', { class: 'field' }, el('label', {}, 'Campaign / placement'),
        el('input', { value: line.placement || '', oninput: (e) => save({ placement: e.target.value }) })),
      el('div', { class: 'field' }, el('label', {}, 'Supplier'),
        el('input', { value: line.supplier || '', oninput: (e) => save({ supplier: e.target.value }) }))));
}

function commercials(line, save, m) {
  const fx = fxMap();
  const ccys = Object.keys(fx);
  return el('div', {},
    el('div', { class: 'row3' },
      el('div', { class: 'field' },
        el('label', {}, 'Spend currency'),
        el('select', { oninput: (e) => save({ currency: e.target.value }) },
          ...ccys.map((c) => el('option', { value: c, selected: c === (line.currency || 'AUD') }, c))),
        el('div', { class: 'hint' }, `1 AUD = ${perAud(line.currency || 'AUD', fx, m.campaign)}`)),
      el('div', { class: 'field' },
        el('label', {}, 'Booked rate — media'),
        el('input', {
          type: 'number', step: 'any', value: line.rate_media ?? '',
          oninput: (e) => save({ rate_media: e.target.value === '' ? null : Number(e.target.value) }),
        })),
      el('div', { class: 'field' },
        el('label', {}, 'Booked rate — GMS'),
        el('input', {
          type: 'number', step: 'any', value: line.rate_gms ?? '',
          oninput: (e) => save({ rate_gms: e.target.value === '' ? null : Number(e.target.value) }),
        }))),
    el('div', { class: 'row3' },
      el('div', { class: 'field' },
        el('label', {}, 'Margin %'),
        el('input', {
          type: 'number', step: 'any', value: line.margin_pct == null ? '' : (line.margin_pct * 100).toFixed(2),
          oninput: (e) => save({ margin_pct: e.target.value === '' ? null : Number(e.target.value) / 100 }),
        }),
        tip('Pulled from the media plan. Changing it changes every client-facing number on this line.', 'Margin help')),
      el('div', { class: 'field' },
        el('label', {}, 'Net media cost (AUD)'),
        el('input', {
          type: 'number', step: 'any', value: line.cost_media ?? '',
          oninput: (e) => save({ cost_media: e.target.value === '' ? null : Number(e.target.value) }),
        })),
      el('div', { class: 'field' },
        el('label', {}, 'Net GMS cost (AUD)'),
        el('input', {
          type: 'number', step: 'any', value: line.cost_gms ?? '',
          oninput: (e) => save({ cost_gms: e.target.value === '' ? null : Number(e.target.value) }),
        }),
        el('div', { class: 'hint' }, line.cost_media != null && line.margin_pct
          ? `at margin: ${money(grossUp(line.cost_media, line.margin_pct))}` : ''))),
    el('div', { class: 'field' },
      el('label', {},
        el('input', {
          type: 'checkbox', checked: line.billable !== false, style: { width: 'auto', marginRight: '7px' },
          oninput: (e) => save({ billable: e.target.checked }),
        }), 'Billable — include in pacing, cost efficiency and the client report')));
}

const round2 = (n) => Math.round(n * 100) / 100;
const editableNumber = (value) => {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return n.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
};

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
        class: 'btn ghost sm', 'aria-label': 'Remove this screenshot',
        onclick: () => confirmDanger({
          title: 'Delete this screenshot?',
          detail: `The saved artwork preview for ${c.name || 'this creative'} will be removed from the dashboard and future exports.`,
          confirmLabel: 'Delete screenshot',
          onConfirm: () => { put('creative', { id: c.id, preview_image: null }); refresh(); },
        }),
      }, '✕'));
  }
  return el('button', {
    class: 'btn chip', style: { marginTop: 0 },
    'aria-label': 'Paste a screenshot of this creative',
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
    el('td', {}, creativeNoteButton(c, refresh)),
    el('td', {}, thumbCell(c, refresh)),
    el('td', {}, el('button', {
      class: 'btn ghost sm', 'aria-label': 'Remove creative',
      onclick: () => {
        const owned = where('spend', (x) => x.creative_id === c.id).length;
        const impact = spendOf(c.id);
        confirmDanger({
          title: `Delete ${c.name || 'this creative'}?`,
          detail: owned
            ? `This permanently deletes ${owned} cumulative ${owned === 1 ? 'snapshot' : 'snapshots'}. `
              + `The line and campaign totals will decrease by ${money(impact, line.currency || 'AUD', 0)}.`
            : 'This creative has no tracked snapshots yet.',
          note: 'If it has simply finished running, set its end date instead so historical spend stays in the totals.',
          confirmLabel: 'Delete creative and data',
          onBackup: exportBackup,
          onConfirm: () => { deleteCreative(c.id); refresh(); },
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
          el('th', { class: 'num' }, `Booking budget · ${line.currency || 'AUD'}`),
          el('th', { class: 'num' }, 'Spend'), el('th', {}, 'Preview'), el('th', {}, 'Note'),
          el('th', {}, 'Screenshot'), el('th', {}))),
        body))
      : tip('Line-level spend is tracked either way; add creatives only when you want the breakdown.', 'Why add creatives'),
    el('button', {
      class: 'btn sm', style: { marginTop: '8px' },
      onclick: () => addCreativeDialog(line, m, refresh),
    }, '+ Add creative'));
}

function creativeNoteButton(creative, refresh) {
  const hasNote = Boolean(String(creative.note || '').trim());
  return el('button', {
    class: `creative-note-trigger-v2${hasNote ? ' has-note' : ''}`,
    title: hasNote ? 'Open creative note' : 'Add a creative note',
    'aria-label': `${hasNote ? 'Edit' : 'Add'} note for ${creative.name || 'creative'}`,
    onclick: () => creativeNoteDialog(creative, refresh),
  },
  el('span', {}, hasNote ? 'Note' : 'Add note'),
  hasNote ? el('small', {}, '1') : null);
}

function creativeNoteDialog(creative, refresh) {
  const input = el('textarea', {
    rows: 5,
    value: creative.note || '',
    placeholder: 'Add context for this creative',
  });
  const err = errorLine();
  dialog({
    title: 'Creative note',
    sub: creative.name || 'Creative',
    content: [el('div', { class: 'field' }, el('label', {}, 'Note'), input), err],
    actions: [
      ...(creative.note ? [{
        label: 'Delete note', danger: true, onClick: () => {
          confirmDanger({
            title: 'Delete this creative note?',
            detail: `The note attached to ${creative.name || 'this creative'} will be removed.`,
            confirmLabel: 'Delete note',
            onConfirm: () => {
              put('creative', { id: creative.id, note: '' });
              refresh();
            },
          });
        },
      }] : []),
      { label: 'Cancel' },
      {
        label: 'Save note', primary: true, onClick: () => {
          const note = input.value.trim();
          if (!note) {
            err.say(creative.note ? 'Use Delete note to remove this note.' : 'Write a note before saving.');
            return false;
          }
          put('creative', { id: creative.id, note });
          refresh();
          return undefined;
        },
      },
    ],
  });
  setTimeout(() => input.focus(), 30);
}

function addCreativeDialog(line, m, refresh) {
  const name = el('input', { value: 'New creative', placeholder: 'Creative name' });
  const from = el('input', { type: 'date', value: m.campaign.start_date || '' });
  const to = el('input', { type: 'date', value: m.campaign.end_date || '' });
  const target = el('input', { type: 'number', min: '0', step: '0.01', placeholder: '0' });
  const err = errorLine();
  dialog({
    title: 'Add a creative',
    sub: 'Dates decide when it appears in Tracking Entry. Booking budget drives its evenly paced monthly progress.',
    content: [
      el('div', { class: 'field' }, el('label', {}, 'Creative name'), name),
      el('div', { class: 'row2' },
        el('div', { class: 'field' }, el('label', {}, 'Start date'), from),
        el('div', { class: 'field' }, el('label', {}, 'End date'), to)),
      el('div', { class: 'field' }, el('label', {}, `Booking budget · ${line.currency || 'AUD'}`), target),
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
        if (!(budget > 0)) { err.say(`Set a booking budget in ${line.currency || 'AUD'}.`); return false; }
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
