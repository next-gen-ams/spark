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
import { dialog, confirmDanger, textField, errorLine } from './modal.js';
import { whoAmI, setWhoAmI } from './who.js';

const isTrackingNote = (note) => !note.kind || note.kind === 'tracking';

/** Entries visible from one line: campaign-wide entries plus that line's own.
 * A line-scoped entry must never appear under a sibling line. */
export function notesFor({ campaignId, lineId } = {}) {
  return where('note', (n) => isTrackingNote(n) && (lineId
    ? (n.line_id === lineId || (n.campaign_id === campaignId && !n.line_id))
    : (n.campaign_id === campaignId && !n.line_id)))
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))
      || String(b.id).localeCompare(String(a.id)));
}

/** Everything visible from a campaign: its own entries plus its lines'. */
export function campaignLog(campaignId, { sharedOnly = false } = {}) {
  const lineIds = new Set(where('line', (l) => l.campaign_id === campaignId).map((l) => l.id));
  return all('note')
    .filter((n) => isTrackingNote(n)
      && (n.campaign_id === campaignId || lineIds.has(n.line_id)))
    .filter((n) => !sharedOnly || n.shared === true)
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
}

export const noteCount = (campaignId, lineId) => notesFor({ campaignId, lineId }).length;

/* ------------------------------------------------------- plan note history
 *
 * Client and campaign notes are working context, not tracking-log entries.
 * They share the same table so attribution, offline writes and deletion keep
 * the same guarantees, while `kind` keeps them out of reports and line logs.
 */

function entityKind(table) {
  return table === 'client' ? 'client_note' : 'campaign_note';
}

function storedEntityNotes(table, row) {
  const kind = entityKind(table);
  return all('note').filter((note) => note.kind === kind
    && (table === 'client' ? note.client_id === row.id : note.campaign_note_id === row.id))
    .sort((a, b) => String(b.created_at || b.updated_at || b.date || '').localeCompare(
      String(a.created_at || a.updated_at || a.date || ''))
      || String(b.id).localeCompare(String(a.id)));
}

/** The old single pinned note stays visible until somebody edits or removes
 * it. We do not invent an author or timestamp for text created before history
 * existed. Editing converts it into a normal attributed entry. */
export function entityNotes(table, row) {
  const notes = storedEntityNotes(table, row).map((note) => ({ ...note, legacy: false }));
  const legacy = String(row?.note || '').trim();
  if (legacy) notes.push({
    id: `legacy:${table}:${row.id}`,
    body: legacy,
    legacy: true,
    author: '',
    created_at: '',
  });
  return notes;
}

export function entityNoteCount(table, row) {
  return entityNotes(table, row).length;
}

function isoNow() {
  return new Date().toISOString();
}

function readableTime(value) {
  if (!value) return 'Recorded before note history';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-AU', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

function noteExcerpt(body, limit = 96) {
  const clean = String(body || '').replace(/\s+/g, ' ').trim();
  return clean.length > limit ? `${clean.slice(0, limit - 1)}…` : clean;
}

function authorField(current) {
  const input = el('input', {
    type: 'text', value: current || '', maxlength: '40',
    placeholder: 'Your name', autocomplete: 'name',
  });
  return input;
}

/** Open the additive Client/Campaign note history. Entries start collapsed so
 * a long-lived plan remains scannable; each one can be expanded, edited or
 * removed without touching the other notes. */
export function openEntityNotes({ table, row, rerender }) {
  const label = table === 'client' ? 'Client notes' : 'Campaign notes';
  const singular = table === 'client' ? 'client note' : 'campaign note';
  const root = el('div', { class: 'entity-note-manager' });
  let editor = null;
  let draft = null;

  const requireAuthor = (input, err) => {
    const name = whoAmI() || setWhoAmI(input?.value || '');
    if (name) return name;
    err.textContent = 'Add your name so the team knows who recorded this note.';
    input?.focus();
    return '';
  };

  const paint = () => {
    const rows = entityNotes(table, row);
    const err = el('div', { class: 'derr' });
    const currentAuthor = whoAmI();
    const name = currentAuthor ? null : authorField('');

    const composer = editor ? el('section', { class: 'entity-note-composer' },
      el('div', { class: 'entity-note-composer-head' },
        el('b', {}, editor.mode === 'add' ? `Add ${singular}` : `Edit ${singular}`),
        currentAuthor ? el('span', {}, `Recording as ${currentAuthor}`) : null),
      name ? el('label', { class: 'field' }, el('span', {}, 'Your name'), name) : null,
      draft = el('textarea', {
        rows: 5,
        value: editor.body || '',
        placeholder: 'Add context the team will need later',
        oninput: (event) => { editor.body = event.target.value; },
      }),
      err,
      el('div', { class: 'entity-note-composer-actions' },
        el('button', {
          class: 'btn sm',
          onclick: () => { editor = null; draft = null; paint(); },
        }, 'Cancel'),
        el('button', {
          class: 'btn sm primary',
          onclick: () => {
            const body = String(editor.body || '').trim();
            if (!body) { err.textContent = 'Write the note before saving it.'; draft.focus(); return; }
            const author = requireAuthor(name, err);
            if (!author) return;
            const now = isoNow();
            if (editor.legacy) {
              put(table, { id: row.id, note: '' });
              row.note = '';
              put('note', {
                id: newId('nt'), kind: entityKind(table),
                client_id: table === 'client' ? row.id : null,
                campaign_note_id: table === 'campaign' ? row.id : null,
                campaign_id: null,
                line_id: null, date: todayIso(), body, shared: false,
                author, created_at: now, updated_at: now, updated_by: author,
              });
            } else if (editor.id) {
              put('note', {
                id: editor.id, body, updated_at: now, updated_by: author,
              });
            } else {
              put('note', {
                id: newId('nt'), kind: entityKind(table),
                client_id: table === 'client' ? row.id : null,
                campaign_note_id: table === 'campaign' ? row.id : null,
                campaign_id: null,
                line_id: null, date: todayIso(), body, shared: false,
                author, created_at: now, updated_at: now, updated_by: author,
              });
            }
            editor = null; draft = null; paint(); rerender?.();
          },
        }, 'Save note')))
      : null;

    const list = rows.length
      ? el('div', { class: 'entity-note-list' }, ...rows.map((note) => {
        const edited = !note.legacy && note.updated_at && note.created_at
          && note.updated_at !== note.created_at;
        return el('details', { class: 'entity-note-item' },
          el('summary', {},
            el('div', {},
              el('b', {}, noteExcerpt(note.body) || 'Empty note'),
              el('span', {}, note.legacy
                ? 'Earlier pinned note'
                : `${note.author || 'Unknown author'} · ${readableTime(note.created_at || note.updated_at)}`)),
            el('span', { class: 'entity-note-chevron', 'aria-hidden': 'true' })),
          el('div', { class: 'entity-note-body' },
            el('p', {}, note.body || ''),
            edited ? el('small', {}, `Last edited by ${note.updated_by || note.author || 'unknown'} · ${readableTime(note.updated_at)}`) : null,
            note.legacy ? el('small', {}, 'This was saved before author and time history was available.') : null,
            el('div', { class: 'entity-note-actions' },
              el('button', {
                class: 'btn sm ghost',
                onclick: () => {
                  editor = { id: note.legacy ? '' : note.id, legacy: note.legacy, mode: 'edit', body: note.body || '' };
                  paint(); setTimeout(() => draft?.focus(), 30);
                },
              }, 'Edit'),
              el('button', {
                class: 'btn sm ghost danger-text',
                onclick: () => confirmDanger({
                  title: `Delete ${singular}?`,
                  detail: noteExcerpt(note.body, 140) || 'Empty note',
                  confirmLabel: 'Delete note',
                  onConfirm: () => {
                    if (note.legacy) {
                      put(table, { id: row.id, note: '' });
                      row.note = '';
                    }
                    else remove('note', note.id);
                    paint(); rerender?.();
                  },
                }),
              }, 'Delete'))));
      }))
      : el('div', { class: 'entity-note-empty' },
        el('b', {}, 'No notes yet'),
        el('span', {}, 'Add the first dated note for this plan.'));

    fill(root,
      el('div', { class: 'entity-note-toolbar' },
        el('div', {}, el('b', {}, `${rows.length} ${rows.length === 1 ? 'note' : 'notes'}`),
          el('span', {}, 'Newest first, collapsed until needed')),
        editor ? null : el('button', {
          class: 'btn sm primary',
          onclick: () => { editor = { mode: 'add', body: '' }; paint(); setTimeout(() => draft?.focus(), 30); },
        }, 'Add note')),
      composer,
      list);
  };

  paint();
  dialog({
    title: label,
    sub: 'A dated history of plan context, with author, edit and delete controls.',
    width: '680px',
    content: [root],
    actions: [{ label: 'Close' }],
    onBeforeClose: () => {
      if (!editor || !String(editor.body || '').trim()) return undefined;
      root.querySelector('.derr').textContent = 'Cancel the draft or save it before closing.';
      draft?.focus();
      return false;
    },
  });
}

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
  const scope = el('select', { 'aria-label': 'Which entries this is filed under' },
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
    const rows = notesFor({ campaignId, lineId });
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
    fill(list, ...rows.map((n) => el('div', { class: 'logitem' },
      el('div', { class: 'loghead' },
        el('b', {}, n.date ? dateAu(n.date) : '—'),
        n.author ? el('span', { class: 'muted', style: { fontSize: '11.5px' } }, n.author) : null,
        el('span', { class: 'tag' + (n.shared ? ' good' : '') },
          n.shared ? 'Shared with client' : 'Internal only'),
        n.line_id ? el('span', { class: 'muted', style: { fontSize: '11px' } }, 'this line') : null,
        el('div', { style: { flex: 1 } }),
        el('button', {
          class: 'btn ghost sm', 'aria-label': n.shared
            ? 'Stop sharing — it will drop out of client reports'
            : 'Share with the client — it will appear in client reports',
          onclick: () => { put('note', { id: n.id, shared: !n.shared }); paint(); rerender && rerender(); },
        }, n.shared ? 'Unshare' : 'Share'),
        el('button', {
          class: 'btn ghost sm', 'aria-label': 'Delete this entry',
          onclick: () => confirmDanger({
            title: 'Delete tracking log entry?',
            detail: `${n.date ? dateAu(n.date) : 'No date'} · ${String(n.body || '').slice(0, 120) || 'Empty entry'}`,
            confirmLabel: 'Delete entry',
            onConfirm: () => { remove('note', n.id); paint(); rerender && rerender(); },
          }),
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
