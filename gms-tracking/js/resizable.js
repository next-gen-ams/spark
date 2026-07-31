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

const MIN = 56;

/**
 * @param {HTMLTableElement} table
 * @param {string} key  identifies this table's widths in storage
 */
export function resizable(table, key) {
  const head = table.tHead?.rows?.[0];
  if (!head || table.dataset.resizable === key) return table;
  table.dataset.resizable = key;

  const cells = [...head.cells];
  const stored = load()[key];

  /* Applying stored widths needs the fixed layout too, or the browser will
     treat them as suggestions and quietly ignore the narrow ones. */
  if (stored && stored.length === cells.length) applyWidths(table, cells, stored);

  cells.forEach((th, i) => {
    if (i === cells.length - 1) return;            // last column takes the slack
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
      document.body.classList.add('col-resizing');

      const move = (ev) => {
        widths[i] = Math.max(MIN, startW + (ev.clientX - startX));
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
      const all = load(); delete all[key]; save(all);
      table.style.tableLayout = '';
      table.querySelector('colgroup.rz')?.remove();
    });
  });

  return table;
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
}

function setWidth(table, i, w) {
  const group = table.querySelector('colgroup.rz');
  if (!group) return;
  group.children[i].style.width = w + 'px';
  table.style.width = [...group.children]
    .reduce((a, c) => a + parseFloat(c.style.width || 0), 0) + 'px';
}
