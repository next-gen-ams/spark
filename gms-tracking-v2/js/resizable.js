/* Drag-resizable table columns.
 *
 * Tables start in the browser's own auto layout, so they fill the card and
 * size themselves sensibly out of the box. The moment a column is dragged, the
 * current widths are measured and frozen into a <colgroup> — from then on the
 * table is under explicit control and nothing reflows behind your back.
 *
 * Widths persist per table key, because re-widening the same column every
 * morning is exactly the kind of small tax that makes people stop using a tool.
 */

const KEY = 'gms-tracking-colw';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}
function save(all) {
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* quota — not worth failing over */ }
}

/* A column of figures can go narrow; a column of prose cannot. 56px of a
   sentence is one letter per line and a row four hundred pixels tall, which
   is technically "nothing was lost" and practically unusable. */
const MIN_NUM = 64;
const MIN_TEXT = 96;
const MIN_PROSE = 150;

/**
 * The width of the longest single word in a header, at the header's own font.
 *
 * Headers are uppercased and letter-spaced, so "SHOULD" is far wider than its
 * six characters suggest. Without this, dragging a column past that width
 * splits the word down the middle — "SHOUL / D BE" — which reads worse than
 * the ellipsis it replaced.
 */
function headerWordWidth(th) {
  const probe = document.createElement('span');
  const cs = getComputedStyle(th);
  Object.assign(probe.style, {
    position: 'absolute', visibility: 'hidden', whiteSpace: 'pre',
    font: cs.font, letterSpacing: cs.letterSpacing, textTransform: cs.textTransform,
  });
  document.body.appendChild(probe);
  let widest = 0;
  for (const word of th.textContent.trim().split(/\s+/)) {
    probe.textContent = word;
    widest = Math.max(widest, probe.getBoundingClientRect().width);
  }
  probe.remove();
  /* `|| 0`, not bare parseFloat: an unstyled header gives '' for padding, and
     NaN here propagated all the way to minWidth() where `NaN || 0` turned the
     whole floor off in silence. A slightly low floor is recoverable; a floor
     that has quietly stopped existing is not. */
  const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  return Math.ceil(widest + pad) + GRIP;
}

/* The grip straddles the cell border, so it eats a few pixels of label space. */
const GRIP = 8;

/**
 * The floors above, measured for every header in one pass.
 *
 * They have to be read with the header's *real* font, and a table that has not
 * been appended yet has no computed style at all — Chrome returns an empty
 * string for every property on a detached element. `parseFloat('')` is NaN, the
 * floors came back NaN, and `NaN || 0` in minWidth() quietly turned them into
 * zero: the "a header never truncates and never splits mid-word" guarantee was
 * never actually in force. Parking the table off-screen for the length of the
 * measurement gets the real metrics without a visible reflow.
 */
function measureHeaderFloors(table, cells) {
  if (table.isConnected) return cells.map(headerWordWidth);
  const parent = table.parentNode;
  const next = table.nextSibling;
  const shim = document.createElement('div');
  shim.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden;width:4000px';
  document.body.appendChild(shim);
  shim.appendChild(table);
  const floors = cells.map(headerWordWidth);
  shim.removeChild(table);
  shim.remove();
  if (parent) parent.insertBefore(table, next);
  return floors;
}

export function minWidth(table, i, headerFloors) {
  const cell = table.tBodies?.[0]?.rows?.[0]?.cells?.[i];
  const byType = !cell ? MIN_TEXT
    : cell.classList.contains('prose') || cell.classList.contains('wrap') ? MIN_PROSE
      : cell.classList.contains('num') ? MIN_NUM
        : MIN_TEXT;
  return Math.max(byType, headerFloors?.[i] || 0);
}

/**
 * @param {HTMLTableElement} table
 * @param {string} key       identifies this table's widths in storage
 * @param {number[]} [defaults]  starting widths, one per column
 *
 * Left to itself the browser hands most of the width to whichever column holds
 * the longest string, which is rarely the one you want to read. Passing
 * deliberate defaults means the table is legible before anyone touches it.
 */
export function resizable(table, key, defaults) {
  const head = table.tHead?.rows?.[0];
  if (!head || table.dataset.resizable === key) return table;
  table.dataset.resizable = key;

  const cells = [...head.cells];
  const stored = load()[key];

  /* Measured once, before any width is forced — the header is still at its
     natural font here and the answer does not change as columns are dragged. */
  const headerFloors = measureHeaderFloors(table, cells);
  const clamp = (widths) => widths.map((w, i) => Math.max(w, minWidth(table, i, headerFloors)));

  if (stored && stored.length === cells.length) applyWidths(table, cells, clamp(stored));
  else if (defaults && defaults.length === cells.length) applyWidths(table, cells, clamp(defaults));

  /* Every column gets one, the last included — it is the one most likely to
     hold a long sentence, and without a grip there is no way to widen it back
     out once the table is under fixed layout. */
  cells.forEach((th, i) => {
    const grip = document.createElement('span');
    grip.className = 'colgrip';
    grip.title = 'Drag to resize · double-click to reset this column';
    th.appendChild(grip);

    grip.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();

      /* Freeze whatever the browser worked out, then adjust from there. */
      const widths = cells.map((c) => Math.round(c.getBoundingClientRect().width));
      applyWidths(table, cells, widths);

      const startX = e.clientX;
      const startW = widths[i];
      const floor = minWidth(table, i, headerFloors);
      document.body.classList.add('col-resizing');

      const move = (ev) => {
        widths[i] = Math.max(floor, startW + (ev.clientX - startX));
        setWidth(table, i, widths[i]);
      };
      const up = () => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        document.body.classList.remove('col-resizing');
        const all = load(); all[key] = widths; save(all);
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });

    grip.addEventListener('dblclick', (e) => {
      e.preventDefault(); e.stopPropagation();
      resetWidths(table, key, defaults && clamp(defaults), cells);
    });
  });

  return table;
}

/** Back to the deliberate defaults, or to the browser's own sizing. */
export function resetWidths(table, key, defaults, cells) {
  const all = load(); delete all[key]; save(all);
  table.querySelector('colgroup.rz')?.remove();
  table.style.tableLayout = '';
  table.style.width = '';
  const head = cells || [...(table.tHead?.rows?.[0]?.cells || [])];
  if (defaults && defaults.length === head.length) applyWidths(table, head, defaults);
}

/** Clear every stored width — for a "reset columns" control. */
export function forgetWidths(key) {
  const all = load();
  if (key) delete all[key]; else Object.keys(all).forEach((k) => delete all[k]);
  save(all);
}

function applyWidths(table, cells, widths) {
  let group = table.querySelector('colgroup.rz');
  if (!group) {
    group = document.createElement('colgroup');
    group.className = 'rz';
    cells.forEach(() => group.appendChild(document.createElement('col')));
    table.insertBefore(group, table.firstChild);
  }
  widths.forEach((w, i) => { group.children[i].style.width = w + 'px'; });
  table.style.tableLayout = 'fixed';
  table.style.width = widths.reduce((a, b) => a + b, 0) + 'px';
  titleTruncatedCells(table);
}

/**
 * Under fixed layout a narrow column shows an ellipsis, which is honest but
 * unreadable. Carry the full text into a tooltip so nothing is lost — only
 * where there isn't already a more useful one.
 */
function titleTruncatedCells(table) {
  for (const cell of table.querySelectorAll('td')) {
    if (cell.title || cell.querySelector('input, select, button')) continue;
    const text = cell.textContent.trim();
    if (text) cell.title = text;
  }
}

function setWidth(table, i, w) {
  const group = table.querySelector('colgroup.rz');
  if (!group) return;
  group.children[i].style.width = w + 'px';
  table.style.width = [...group.children]
    .reduce((a, c) => a + parseFloat(c.style.width || 0), 0) + 'px';
}
