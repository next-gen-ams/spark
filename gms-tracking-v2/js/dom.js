/* Tiny DOM + formatting helpers. No framework — the whole app is one page of
   tables, and a 3kb helper beats a 40kb runtime for that. */

export function el(tag, props = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    /* ARIA state is a string, not a boolean HTML attribute. It has to be set
       even when false — aria-pressed="false" is "an unpressed toggle", while
       no attribute at all is "not a toggle" — and it must read "true", not "".
       Rendering it empty makes every [aria-pressed="true"] rule silently miss,
       which is how the view toggle and the tab highlight lost their styling. */
    if (k.startsWith('aria-') && v != null) { node.setAttribute(k, String(v)); continue; }
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'value') node.value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'selected') node[k] = !!v;
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  add(node, kids);
  return node;
}

function add(node, kids) {
  for (const k of kids.flat(4)) {
    if (k == null || k === false) continue;
    node.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const clear = (node) => { while (node.firstChild) node.removeChild(node.firstChild); return node; };
export const fill = (node, ...kids) => { clear(node); add(node, kids); return node; };

/**
 * Compact contextual help. The explanation stays out of the working surface
 * and appears on pointer hover or keyboard focus. Critical errors, destructive
 * consequences and save state deliberately remain visible text.
 */
export function tip(text, label = 'Help') {
  if (!text) return null;
  return el('span', {
    class: 'tip-bulb',
    role: 'img',
    tabindex: '0',
    'aria-label': `${label}: ${text}`,
    'data-tip': text,
  }, '💡︎');
}

/* ------------------------------------------------------------- formatting */

const nf = (min, max) => new Intl.NumberFormat('en-AU', {
  minimumFractionDigits: min, maximumFractionDigits: max,
});

export const money = (v, ccy = 'AUD', dp = 0) => {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const sym = ccy === 'AUD' ? '$' : ccy === 'CNY' ? '¥' : '';
  return (sym ? sym : ccy + ' ') + nf(dp, dp).format(Number(v));
};

/* On screen, money is whole dollars — decimals are visual noise at dashboard
   distance (Coco, 2026-08-02). The cents still exist: storage is untouched
   and the Excel exports print two decimals throughout. The name money2 is
   kept so every call site keeps declaring "this is a money figure". */
export const money2 = (v, ccy = 'AUD') => money(v, ccy, 0);

export const int = (v) => (v == null || !Number.isFinite(Number(v)) ? '—' : nf(0, 0).format(Number(v)));

export const pct = (v, dp = 0) =>
  (v == null || !Number.isFinite(Number(v)) ? '—' : nf(dp, dp).format(Number(v) * 100) + '%');

export const rate = (v, ccy = 'AUD') =>
  (v == null || !Number.isFinite(Number(v)) ? '—' : money(v, ccy, Number(v) < 10 ? 2 : 2));

/**
 * A value fit to show, or ''.
 *
 * Media plans write "-" or "N/A" in a cell that is simply empty. Those are
 * truthy strings, so every `a || b || 'fallback'` chain picked them over the
 * next candidate and they reached the screen verbatim — a scope dropdown
 * reading "This line only — -", a row labelled "— · Campaign Implement".
 */
export const shown = (v) => {
  const t = String(v ?? '').trim();
  return /^(-+|–|—|n\.?\s*a\.?|n\/a|none|null|undefined)$/i.test(t) ? '' : t;
};

export const dateAu = (isoStr) => {
  if (!isoStr) return '—';
  const [y, m, d] = isoStr.split('-');
  return `${d}/${m}/${y.slice(2)}`;
};

export const monthLabel = (ym) => {
  if (!ym) return 'All months';
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
};

/* ---------------------------------------------------------------- widgets */

export function meter(pacingPct, timePct, flag) {
  const w = Math.min(100, Math.max(0, (pacingPct || 0) * 100));
  const t = timePct == null ? null : Math.min(100, Math.max(0, timePct * 100));
  return el('div', {
    class: 'meter',
    'aria-label': `Spend ${pct(pacingPct, 1)} of budget · time elapsed ${t == null ? '—' : pct(timePct, 1)}`,
  },
  el('i', { class: flag, style: { width: w + '%' } }),
  t == null ? null : el('u', { style: { left: t + '%' } }));
}

export function tag(text, kind, title) {
  return el('span', { class: 'tag' + (kind ? ' ' + kind : ''), 'aria-label': title || null }, text);
}

/** A <select> that also lets the user type a value that isn't in the list. */
/**
 * How "+ Add new…" asks for the new value.
 *
 * dom.js is the bottom of the import graph — modal.js depends on it, so it
 * cannot depend on modal.js in return. The dialog registers itself here
 * instead, which keeps the cycle from forming and leaves a working fallback
 * for anything that loads dom.js on its own.
 */
let askForText = async (title) => window.prompt(title, '');
export const setTextPrompt = (fn) => { askForText = fn; };

export function selectOrNew(value, options, onPick, { allowNew = true, cls = 'pill-sel' } = {}) {
  const NEW = '__new__';
  const sel = el('select', { class: cls, onchange: async () => {
    if (sel.value !== NEW) return onPick(sel.value);
    sel.value = value || '';
    const v = await askForText('Add a new option');
    if (v && v.trim()) onPick(v.trim());
  } },
  el('option', { value: '' }, '—'),
  ...options.map((o) => el('option', { value: o, selected: o === value }, o)),
  value && !options.includes(value) ? el('option', { value, selected: true }, value) : null,
  allowNew ? el('option', { value: NEW }, '+ Add new…') : null);
  return sel;
}

export function download(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * @param {number} [ms] how long it stays. The default suits acknowledgements
 * ("saved"); anything carrying numbers the user might want to read — an import
 * result, a row count — should pass longer, because a toast that vanishes
 * mid-read might as well not have appeared.
 */
export function toast(msg, kind = 'ok', ms = 3600) {
  const t = el('div', {
    class: 'chip' + (kind === 'bad' ? ' crit' : ''),
    style: {
      position: 'fixed', bottom: '22px', left: '50%', transform: 'translateX(-50%)',
      zIndex: 90, boxShadow: 'var(--shadow-lg)', background: 'var(--surface)',
    },
  }, el('span', { class: 'dot' }), msg);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}
