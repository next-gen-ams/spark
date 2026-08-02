/* The tracking log.
 *
 * Numbers say what happened; they never say why. "Spend dropped 40% in week
 * three" is a mystery six weeks later unless someone wrote "client paused the
 * Campus Day push pending approvals". This is where that sentence lives.
 *
 * An entry hangs off a campaign or off a single line. Campaign-level is the
 * default because most of what is worth writing down — a brief change, an
 * approval delay, a platform outage — affects everything under it; line-level
 * is there for when the note really is about one placement.
 *
 * The `shared` flag is the load-bearing part. This dashboard's whole
 * discipline is that nothing internal reaches a client by accident, and free
 * text is the easiest way to break that: "dropped the margin to 20% to keep
 * them happy" is one careless export away from the client reading it. So an
 * entry is **internal by default** and has to be deliberately marked before it
 * can appear in a client report — the same shape as the export dialog's "who
 * is this for" question, for the same reason.
 */

import { el, fill, dateAu, shown } from './dom.js';
import { all, put, remove, newId, where } from './store.js';
import { todayIso } from './calc.js';
import { dialog, textField, errorLine } from './modal.js';
import { whoAmI, setWhoAmI } from './who.js';

/** Entries for a campaign, newest first. `lineId` narrows to one line. */
export function notesFor({ campaignId, lineId } = {}) {
  return where('note', (n) => (lineId
    ? n.line_id === lineId
    : n.campaign_id === campaignId))
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))
      || String(b.id).localeCompare(String(a.id)));
}

/** Everything visible from a campaign: its own entries plus its lines'. */
export function campaignLog(campaignId, { sharedOnly = false } = {}) {
  const lineIds = new Set(where('line', (l) => l.campaign_id === campaignId).map((l) => l.id));
  return all('note')
    .filter((n) => n.campaign_id === campaignId || lineIds.has(n.line_id))
    .filter((n) => !sharedOnly || n.shared === true)
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
}

export const noteCount = (campaignId) => campaignLog(campaignId).length;

/* --------------------------------------------------------------------- UI */

/**
 * Read and add entries. Opened from a line, so it offers both scopes: this
 * line, or the campaign it belongs to.
 */
export function openLog(m, rerender) {
  const campaignId = m.campaign?.id;
  const lineId = m.line?.id;
  const err = errorLine();

  const body = el('textarea', {
    rows: 3, placeholder: 'What happened? e.g. “Client paused Campus Day push pending approvals — restart 12/08.”',
    /* Plain Enter has to stay a newline — entries run to several lines. */
    onkeydown: (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) add(); },
  });
  const date = el('input', { type: 'date', value: todayIso() });
  /* The full campaign name is already on the row the user opened this from, so
     the option leads with the scope — the part that changes what happens. */
  const scope = el('select', { title: 'Which entries this is filed under' },
    el('option', { value: 'campaign', selected: true },
      `Whole campaign — ${m.campaignName || 'campaign'}`),
    el('option', { value: 'line' },
      `This line only — ${shown(m.line.placement) || shown(m.line.platform) || 'this line'}`));
  const shared = el('input', { type: 'checkbox' });

  /* Asked once per browser, then out of the way. A name box on every entry
     would be a field to skip; a line saying who you are is a fact to correct. */
  let author = whoAmI();
  const nameField = textField('Your name', {
    value: author,
    placeholder: 'so the team knows who to ask',
    hint: 'Kept in this browser only, and stamped on the entries you add.',
  });
  const nameLine = el('div', { class: 'hint', style: { marginTop: '-8px', marginBottom: '14px' } });
  const paintName = () => {
    nameField.style.display = author ? 'none' : '';
    fill(nameLine, author ? `Logging as ${author}. ` : '',
      author ? el('button', {
        class: 'linkish',
        onclick: () => { author = setWhoAmI(''); nameField.set(''); paintName(); nameField.focus(); },
      }, 'Not you?') : null);
  };

  const list = el('div', { class: 'loglist' });
  const logLabel = el('label', {}, 'Logged so far');

  const paint = () => {
    const rows = campaignLog(campaignId);
    /* Say how many and in what order — otherwise a list that scrolls looks
       like a list that ends, and the older entries are never found. */
    fill(logLabel, rows.length
      ? `Logged so far — ${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}, newest first`
      : 'Logged so far');
    if (!rows.length) {
      fill(list, el('div', { class: 'hint' },
        'Nothing logged for this campaign yet. The first entry is usually the most useful one.'));
      return;
    }
    fill(list, ...rows.slice().reverse().map((n) => el('div', { class: 'logitem' },
      el('div', { class: 'loghead' },
        el('b', {}, n.date ? dateAu(n.date) : '—'),
        n.author ? el('span', { class: 'muted', style: { fontSize: '11.5px' } }, n.author) : null,
        el('span', { class: 'tag' + (n.shared ? ' good' : '') },
          n.shared ? 'Shared with client' : 'Internal only'),
        n.line_id ? el('span', { class: 'muted', style: { fontSize: '11px' } }, 'this line') : null,
        el('div', { style: { flex: 1 } }),
        el('button', {
          class: 'btn ghost sm', title: n.shared
            ? 'Stop sharing — it will drop out of client reports'
            : 'Share with the client — it will appear in client reports',
          onclick: () => { put('note', { id: n.id, shared: !n.shared }); paint(); rerender && rerender(); },
        }, n.shared ? 'Unshare' : 'Share'),
        el('button', {
          class: 'btn ghost sm', title: 'Delete this entry',
          onclick: () => { remove('note', n.id); paint(); rerender && rerender(); },
        }, '✕')),
      el('p', {}, n.body || ''))));
  };

  const add = () => {
    const text = body.value.trim();
    if (!text) { err.say('Write the entry first — an empty log line helps nobody.'); return false; }
    if (!author) {
      author = setWhoAmI(nameField.value());
      if (!author) {
        err.say('Put your name in first, so the team knows who to ask about this.');
        nameField.focus();
        return false;
      }
      paintName();
    }
    put('note', {
      id: newId('nt'),
      campaign_id: campaignId || null,
      line_id: scope.value === 'line' ? lineId : null,
      date: date.value || todayIso(),
      body: text,
      author,
      shared: shared.checked === true,
    });
    body.value = ''; shared.checked = false; err.say('');
    paint();
    rerender && rerender();
    return false;                        // keep the dialog open to write another
  };

  paint();
  paintName();
  dialog({
    title: 'Tracking log',
    sub: 'What happened, in the team’s own words, so a number nobody can explain six weeks later has an explanation attached.',
    width: '600px',
    content: [
      el('div', { class: 'field' }, el('label', {}, 'New entry'), body),
      el('div', { class: 'row2' },
        el('div', { class: 'field' }, el('label', {}, 'Date'), date),
        el('div', { class: 'field' }, el('label', {}, 'Applies to'), scope)),
      nameField,
      nameLine,
      el('label', { class: 'choice', style: { alignItems: 'center', marginBottom: '4px' } },
        shared,
        el('span', {},
          el('b', {}, 'Share this entry with the client'),
          el('span', { class: 'cnote' },
            'Off by default. Only shared entries reach a client report. Everything else stays inside GMS.'))),
      err,
      el('div', { class: 'field' }, logLabel, list),
    ],
    /* "Add entry" is the primary button and "Close" is not.
       The first version had them the other way round, and the blue button on
       the right — the one every dialog trains you to press — threw the entry
       away without a word. Coco wrote a log, pressed it, and the entry was
       never created. Emphasis follows consequence: the button that keeps your
       work is the one that looks like the answer. */
    actions: [
      { label: 'Close' },
      { label: 'Add entry', primary: true, onClick: add },
    ],
    /* And no exit — button, Escape, or scrim — discards typed text in silence. */
    onBeforeClose: () => {
      if (!body.value.trim()) return undefined;
      err.say('You’ve written an entry but haven’t added it yet. '
        + 'Press Add entry (or ⌘/Ctrl + Enter), or clear the box to close.');
      body.focus();
      return false;
    },
  });
  setTimeout(() => body.focus(), 30);
}
