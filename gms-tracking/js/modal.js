/* In-app dialogs.
 *
 * These replace window.prompt / window.confirm, which were doing the job badly
 * in three separate ways:
 *
 *   1. They cannot be styled, so every decision the app asks for looked like it
 *      came from somewhere else.
 *   2. They cannot hold a form, so "name this creative" and "what happens to
 *      the spend already on the line" had to be two dialogs in a row.
 *   3. Chrome suppresses the *second* dialog in a sequence — the "prevent this
 *      page from creating additional dialogs" behaviour. A suppressed confirm()
 *      returns false, so the question "move the existing spend onto this
 *      creative?" silently answered itself with "no", and the user never saw it
 *      asked. That is exactly the bug this file exists to remove.
 *
 * One dialog, one form, one decision.
 */

import { el, fill } from './dom.js';

let host = null;
let escHandler = null;

function mount() {
  if (!host) { host = el('div'); document.body.appendChild(host); }
  return host;
}

export function closeDialog() {
  if (escHandler) { document.removeEventListener('keydown', escHandler); escHandler = null; }
  if (host) fill(host);
}

/**
 * @param {object} o
 * @param {string} o.title
 * @param {string} [o.sub]           one line under the title
 * @param {Array}  [o.content]       body nodes
 * @param {Array}  o.actions         [{ label, kind, onClick, primary, danger, disabled }]
 * @param {string} [o.width]
 * @returns {{close: Function, setDisabled: Function}}
 */
export function dialog({ title, sub, content = [], actions = [], width }) {
  const h = fill(mount());
  const buttons = [];

  const close = () => closeDialog();

  for (const a of actions) {
    buttons.push(el('button', {
      class: 'btn sm' + (a.danger ? ' danger' : a.primary ? ' primary' : ''),
      disabled: !!a.disabled,
      onclick: () => {
        /* The handler decides whether the dialog survives: a validation failure
           returns false and the box stays open with the message showing. */
        if (a.onClick && a.onClick() === false) return;
        close();
      },
    }, a.label));
  }

  h.appendChild(el('div', { class: 'scrim', onclick: close }));
  h.appendChild(el('div', {
    class: 'dialogbox', role: 'dialog', 'aria-modal': 'true', 'aria-label': title,
    style: width ? { width } : {},
  },
  el('h3', {}, title),
  sub ? el('p', { class: 'dsub' }, sub) : null,
  ...content,
  el('div', { class: 'drow' },
    el('div', { style: { flex: 1 } }),
    ...buttons)));

  escHandler = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', escHandler);

  return { close, buttons };
}

/* ------------------------------------------------------------- form parts */

/** A labelled text input that reports its own value. */
export function textField(label, { value = '', placeholder = '', hint, onEnter } = {}) {
  const input = el('input', {
    type: 'text', value, placeholder,
    onkeydown: (e) => { if (e.key === 'Enter' && onEnter) onEnter(); },
  });
  const node = el('div', { class: 'field' },
    el('label', {}, label), input,
    hint ? el('div', { class: 'hint' }, hint) : null);
  node.value = () => input.value.trim();
  node.focus = () => input.focus();
  return node;
}

/** A labelled select that reports its own value. */
export function selectField(label, options, { value = '', hint, onChange } = {}) {
  const sel = el('select', { onchange: () => onChange && onChange(sel.value) },
    ...options.map((o) => el('option', {
      value: o.value, selected: o.value === value,
    }, o.label)));
  const node = el('div', { class: 'field' },
    el('label', {}, label), sel,
    hint ? el('div', { class: 'hint' }, hint) : null);
  node.value = () => sel.value;
  return node;
}

/**
 * A stack of radio choices, each with its own explanation.
 *
 * Used where the options differ in consequence rather than in degree — the
 * kind of choice that must not be made by picking whichever button is on the
 * right. The explanation carries the number at stake.
 */
export function choiceField(label, choices, { value, onChange } = {}) {
  const name = `ch${Math.random().toString(36).slice(2)}`;
  let current = value ?? choices[0]?.value;
  const inputs = [];

  const node = el('div', { class: 'field' },
    label ? el('label', {}, label) : null,
    el('div', { class: 'choices' }, ...choices.map((c) => {
      const radio = el('input', {
        type: 'radio', name, value: c.value, checked: c.value === current,
        onchange: () => { current = c.value; paint(); onChange && onChange(current); },
      });
      inputs.push({ radio, value: c.value });
      const row = el('label', { class: 'choice' + (c.value === current ? ' on' : '') },
        radio,
        el('span', {},
          el('b', {}, c.label),
          c.note ? el('span', { class: 'cnote' }, c.note) : null));
      return row;
    })));

  function paint() {
    for (const { radio, value: v } of inputs) {
      radio.closest('.choice').classList.toggle('on', v === current);
    }
  }

  node.value = () => current;
  return node;
}

/** A red line inside a dialog, for validation. Starts empty. */
export function errorLine() {
  const node = el('div', { class: 'derr' });
  node.say = (msg) => { fill(node, msg || ''); };
  return node;
}

/* ------------------------------------------------------- destructive ask */

/**
 * The destructive confirm, with the mitigation *on the dialog*.
 *
 * Every confirm used to say "take a backup first" — advice delivered at the
 * exact moment the user cannot act on it without cancelling, hunting for the
 * button, and starting again. Nobody restarts; they click through. Putting
 * Download backup on the dialog turns the advice into a one-click detour that
 * keeps the deletion flowing.
 *
 * `typeToConfirm` adds a word the user has to type — reserved for the wipe,
 * where one click is not enough consent for every client's numbers.
 */
export function confirmDanger({ title, detail, confirmLabel, onConfirm, typeToConfirm, onBackup }) {
  const gate = typeToConfirm
    ? textField(`Type ${typeToConfirm} to enable`, { placeholder: typeToConfirm })
    : null;

  const box = dialog({
    title,
    content: [
      el('p', {}, detail),
      el('p', { class: 'hint' },
        'This cannot be undone. The backup is the whole dashboard as one .json — '
        + 'restore it from Settings ▸ Data.'),
      gate,
    ].filter(Boolean),
    actions: [
      /* Returning false keeps the box open — downloading a backup is a detour,
         not an answer. */
      { label: 'Download backup first', onClick: () => { onBackup && onBackup(); return false; } },
      { label: 'Cancel' },
      {
        label: confirmLabel, danger: true,
        onClick: () => {
          if (gate && gate.value() !== typeToConfirm) return false;
          onConfirm();
          return undefined;
        },
      },
    ],
  });
  if (gate) setTimeout(() => gate.focus(), 30);
  return box;
}
