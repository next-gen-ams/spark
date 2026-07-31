/* Admin — the managed lists everything else picks from. */

import { el, toast, dateAu } from './dom.js';
import { all, put, remove, removeWhere, newId, vocab, addVocab, importJson, wipe, where, loadDemo, isDemo } from './store.js';
import { exportBackup } from './exportxlsx.js';
import { VOCAB_DEFAULT } from './config.js';

export function renderAdmin(host, ctx) {
  const { rerender } = ctx;
  host.appendChild(clients(rerender));
  host.appendChild(campaigns(rerender));
  host.appendChild(fxRates(rerender));
  host.appendChild(vocabs(rerender));
  host.appendChild(data(rerender));
}

function panel(title, sub, ...body) {
  return el('div', { class: 'panel' },
    el('header', {}, el('div', {}, el('h3', {}, title), el('p', {}, sub))),
    ...body);
}

function clients(rerender) {
  const list = all('client').sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const input = el('input', { placeholder: 'New client name', class: 'pill-sel', style: { maxWidth: '240px' } });

  return panel('Clients', 'Used by the client filter and the top-right dropdown.',
    el('div', { class: 'tablewrap' }, el('table', { class: 'data' },
      el('thead', {}, el('tr', {}, el('th', {}, 'Client'), el('th', { class: 'num' }, 'Campaigns'),
        el('th', { class: 'num' }, 'Lines'), el('th', {}, ''))),
      el('tbody', {}, ...list.map((c) => {
        const cmps = where('campaign', (x) => x.client_id === c.id);
        const lines = all('line').filter((l) => cmps.some((k) => k.id === l.campaign_id));
        return el('tr', {},
          el('td', {}, el('input', {
            class: 'cellinput', style: { textAlign: 'left' }, value: c.name || '',
            onchange: (e) => put('client', { id: c.id, name: e.target.value }),
          })),
          el('td', { class: 'num' }, cmps.length),
          el('td', { class: 'num' }, lines.length),
          el('td', {}, el('button', {
            class: 'btn ghost sm',
            onclick: () => {
              if (!confirm(`Delete ${c.name} and its ${cmps.length} campaign(s), lines and spend?`)) return;
              for (const k of cmps) deleteCampaign(k.id);
              remove('client', c.id); rerender(); toast('Client deleted');
            },
          }, 'Delete')));
      })))),
    el('div', { class: 'body', style: { display: 'flex', gap: '8px' } }, input,
      el('button', {
        class: 'btn sm',
        onclick: () => {
          const n = input.value.trim();
          if (!n) return;
          put('client', { id: newId('cl'), name: n, active: true });
          input.value = ''; rerender();
        },
      }, '+ Add client')));
}

function campaigns(rerender) {
  const list = all('campaign');
  if (!list.length) return el('div');
  const clientName = (id) => all('client').find((c) => c.id === id)?.name || '—';

  return panel('Campaigns', 'One per imported media plan. Deleting a campaign removes its lines, budgets and spend.',
    el('div', { class: 'tablewrap' }, el('table', { class: 'data' },
      el('thead', {}, el('tr', {}, el('th', {}, 'Client'), el('th', {}, 'Campaign'),
        el('th', {}, 'IO'), el('th', {}, 'Flight'), el('th', {}, 'FX'),
        el('th', { class: 'num' }, 'Lines'), el('th', {}, 'Imported'), el('th', {}, ''))),
      el('tbody', {}, ...list.map((k) => el('tr', {},
        el('td', {}, clientName(k.client_id)),
        el('td', { class: 'wrap' }, k.name || '—'),
        el('td', { class: 'wrap muted' }, k.io_number || '—'),
        el('td', {}, k.start_date ? `${dateAu(k.start_date)} – ${dateAu(k.end_date)}` : '—'),
        el('td', {}, k.fx_rate ? `1 AUD = ${k.fx_rate} ${k.fx_ccy || ''}` : '—'),
        el('td', { class: 'num' }, all('line').filter((l) => l.campaign_id === k.id).length),
        el('td', { class: 'muted' }, k.imported_at || '—'),
        el('td', {}, el('button', {
          class: 'btn ghost sm',
          onclick: () => {
            if (!confirm(`Delete “${k.name}” with all its lines, budgets and spend?`)) return;
            deleteCampaign(k.id); rerender(); toast('Campaign deleted');
          },
        }, 'Delete'))))))));
}

function deleteCampaign(campaignId) {
  const lineIds = where('line', (l) => l.campaign_id === campaignId).map((l) => l.id);
  for (const id of lineIds) {
    removeWhere('spend', 'line_id', id);
    removeWhere('creative', 'line_id', id);
    removeWhere('line_month', 'line_id', id);
  }
  removeWhere('line', 'campaign_id', campaignId);
  remove('campaign', campaignId);
}

function fxRates(rerender) {
  const list = all('fx').sort((a, b) => String(a.ccy).localeCompare(String(b.ccy)));
  const ccy = el('input', { placeholder: 'CCY', class: 'pill-sel', style: { maxWidth: '80px' } });
  const rate = el('input', { placeholder: 'per 1 AUD', class: 'pill-sel', type: 'number', step: '0.0001', style: { maxWidth: '120px' } });

  return panel('Exchange rates', 'Convention: 1 AUD = X foreign. A rate printed on an IO overrides this for that campaign.',
    el('div', { class: 'tablewrap' }, el('table', { class: 'data' },
      el('thead', {}, el('tr', {}, el('th', {}, 'Currency'), el('th', { class: 'num' }, '1 AUD ='), el('th', {}, ''))),
      el('tbody', {}, ...list.map((f) => el('tr', {},
        el('td', {}, f.ccy),
        el('td', { class: 'num' }, el('input', {
          class: 'cellinput', type: 'number', step: '0.0001', value: f.per_aud ?? '',
          onchange: (e) => put('fx', { ccy: f.ccy, per_aud: Number(e.target.value) || 1 }),
        })),
        el('td', {}, f.ccy === 'AUD' ? null : el('button', {
          class: 'btn ghost sm', onclick: () => { remove('fx', f.ccy); rerender(); },
        }, 'Remove')))))),
    ),
    el('div', { class: 'body', style: { display: 'flex', gap: '8px' } }, ccy, rate,
      el('button', {
        class: 'btn sm',
        onclick: () => {
          const c = ccy.value.trim().toUpperCase(); const r = Number(rate.value);
          if (!c || !(r > 0)) return toast('Need a currency code and a positive rate', 'bad');
          put('fx', { ccy: c, per_aud: r });
          ccy.value = ''; rate.value = ''; rerender();
        },
      }, '+ Add currency')));
}

function vocabs(rerender) {
  const kinds = Object.keys(VOCAB_DEFAULT);
  return panel('Dropdown lists', 'Platform, objective, buy method and status. Anything typed as “+ Add new…” elsewhere lands here.',
    el('div', { class: 'body', style: { display: 'grid', gap: '18px', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' } },
      ...kinds.map((kind) => {
        const input = el('input', { placeholder: 'add…', class: 'pill-sel', style: { width: '100%' } });
        return el('div', {},
          el('div', { class: 'k', style: { fontSize: '10.5px', letterSpacing: '.11em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 620, marginBottom: '7px' } },
            kind.replace('_', ' ')),
          el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' } },
            ...vocab(kind).map((v) => el('span', { class: 'tag' }, v,
              el('button', {
                class: 'btn ghost sm', style: { padding: '0 3px', lineHeight: 1 },
                title: 'Remove from the list (existing lines keep their value)',
                onclick: () => { remove('vocab', `${kind}:${v}`); rerender(); },
              }, '✕')))),
          el('div', { style: { display: 'flex', gap: '6px' } }, input,
            el('button', {
              class: 'btn sm',
              onclick: () => { if (input.value.trim()) { addVocab(kind, input.value); input.value = ''; rerender(); } },
            }, '+')));
      })));
}

function data(rerender) {
  const file = el('input', {
    type: 'file', accept: '.json', style: { display: 'none' },
    onchange: async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      if (!confirm('Restore replaces everything currently in the dashboard. Continue?')) return;
      try { importJson(await f.text()); toast('Backup restored'); rerender(); }
      catch (err) { toast('That file is not a valid backup', 'bad'); }
    },
  });

  return panel('Data', 'Local backups. Keep one before any big import — this build stores data in your browser.',
    el('div', { class: 'body', style: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' } },
      el('button', { class: 'btn', onclick: exportBackup }, 'Download backup (.json)'),
      el('label', { class: 'btn' }, 'Restore backup', file),
      el('button', {
        class: 'btn',
        title: 'Reloads the three reference media plans with made-up spend',
        onclick: async () => {
          if (all('line').length && !isDemo()
            && !confirm('Replace everything currently here with the sample data?')) return;
          await loadDemo() ? toast('Sample data loaded') : toast('data/demo.json not found', 'bad');
          rerender();
        },
      }, isDemo() ? 'Reload sample data' : 'Load sample data'),
      el('div', { style: { flex: 1 } }),
      el('button', {
        class: 'btn', style: { color: 'var(--crit)', borderColor: 'var(--crit)' },
        onclick: () => {
          if (!confirm('Erase every client, campaign, line and spend row? This cannot be undone.')) return;
          if (!confirm('Really erase everything?')) return;
          wipe(); toast('All data cleared'); rerender();
        },
      }, 'Erase everything')));
}
