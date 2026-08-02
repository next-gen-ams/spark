/* Paste a screenshot straight off the clipboard.
 *
 * The team's workflow is: screenshot the ad in the media console, ⌘V. Asking
 * them to save a file first and then drag it in adds two steps to something
 * they do dozens of times.
 *
 * Everything here exists because of one number: a raw macOS screenshot is
 * 0.5–2 MB, and this dashboard's whole database allowance is 500 MB. Storing
 * what the clipboard hands over would spend the project's storage on pixels
 * nobody looks at full-size. So every image is drawn through a canvas and
 * re-encoded before it is ever stored: capped at MAX_W across, JPEG at
 * QUALITY, which lands a typical ad screenshot around 30–50 KB — small enough
 * that a hundred creatives cost single-digit megabytes, and small enough to
 * embed in an Excel export without bloating the file.
 *
 * PNG is deliberately not preserved: screenshots are photographic enough that
 * JPEG wins by 5–10× at a size where the difference is invisible in a 480px
 * thumbnail. Transparency is irrelevant for a screenshot of a screen.
 */

import { el, fill } from './dom.js';

/* Scale down, don't crush.
 *
 * The job is to make the file smaller by making the picture smaller — not by
 * degrading what is left. 720px wide at q0.9 keeps ad copy legible when you
 * hover it, and a screenshot still lands around 60–110 KB: a hundred creatives
 * cost single-digit megabytes of a 500 MB allowance. Aspect ratio is always
 * preserved exactly; nothing here ever stretches an image. */
const MAX_W = 720;
const QUALITY = 0.9;

/** Roughly how many bytes a data URL costs once stored (base64 is ~4/3). */
export const dataUrlBytes = (url) => Math.round(((url || '').length - 22) * 0.75);

export const humanBytes = (n) =>
  (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/**
 * Downscale a Blob or File to a small JPEG data URL.
 * @returns {Promise<{url: string, w: number, h: number, bytes: number}>}
 */
export function shrinkImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_W / img.naturalWidth);
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d');
      /* White behind it: a transparent PNG flattened onto JPEG's default black
         turns a light screenshot into a dark smear. */
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      const out = cv.toDataURL('image/jpeg', QUALITY);
      resolve({ url: out, w, h, bytes: dataUrlBytes(out) });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('not an image')); };
    img.src = url;
  });
}

/**
 * Read a stored image's real pixel dimensions out of its own header.
 *
 * The Excel export has to know the true aspect ratio to place a thumbnail, and
 * guessing it is how a picture ends up stretched. Reading the header rather
 * than storing the numbers alongside means images saved before this existed
 * are handled correctly too — there is nothing to migrate.
 *
 * @param {string} dataUrl
 * @returns {{w: number, h: number}|null}
 */
export function imageSize(dataUrl) {
  const m = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(dataUrl || '');
  if (!m) return null;
  let b;
  try {
    const bin = atob(m[2]);
    b = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  } catch { return null; }

  /* PNG: IHDR is always the first chunk, width and height at bytes 16–23. */
  if (/png/i.test(m[1])) {
    if (b.length < 24) return null;
    const rd = (o) => (b[o] << 24 | b[o + 1] << 16 | b[o + 2] << 8 | b[o + 3]) >>> 0;
    return { w: rd(16), h: rd(20) };
  }

  /* JPEG: walk the marker chain to the start-of-frame, which carries the
     dimensions. DHT/DAC/RST markers are skipped — they are not frames. */
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xFF) { i++; continue; }
    const marker = b[i + 1];
    const isFrame = marker >= 0xC0 && marker <= 0xCF
      && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC;
    if (isFrame) return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] };
    const len = (b[i + 2] << 8) | b[i + 3];
    if (len < 2) return null;
    i += 2 + len;
  }
  return null;
}

/** The first image on a clipboard event, or null. */
export function imageFromClipboard(e) {
  for (const item of e.clipboardData?.items || []) {
    if (item.type?.startsWith('image/')) return item.getAsFile();
  }
  return null;
}

/**
 * A focusable drop/paste target that shows what it holds.
 *
 * Reads its value with `.value()` and reports size with `.bytes()`, so a
 * caller can show the cost before committing. Accepts a paste anywhere while
 * focused, a drag-drop, or a file picker — the picker matters because Safari
 * and Firefox do not always put images on the clipboard the way Chrome does.
 */
export function imageField(label, { value = '', hint, onChange } = {}) {
  let current = value || '';
  const preview = el('div', { class: 'shotprev' });
  const meta = el('div', { class: 'hint' });

  const file = el('input', {
    type: 'file', accept: 'image/*', style: { display: 'none' },
    onchange: (e) => { if (e.target.files?.[0]) take(e.target.files[0]); },
  });

  const zone = el('div', {
    class: 'pastezone', tabindex: '0',
    role: 'button', 'aria-label': `${label}. Paste or choose an image.`,
    onclick: () => { if (!current) file.click(); },
    onpaste: (e) => {
      const f = imageFromClipboard(e);
      if (f) { e.preventDefault(); take(f); }
    },
    ondragover: (e) => { e.preventDefault(); zone.classList.add('over'); },
    ondragleave: () => zone.classList.remove('over'),
    ondrop: (e) => {
      e.preventDefault(); zone.classList.remove('over');
      const f = e.dataTransfer?.files?.[0];
      if (f && f.type.startsWith('image/')) take(f);
    },
  });

  async function take(blob) {
    fill(meta, 'Shrinking…');
    try {
      const r = await shrinkImage(blob);
      current = r.url;
      paint(`${r.w}×${r.h} · ${humanBytes(r.bytes)} stored`);
      onChange && onChange(current);
    } catch {
      fill(meta, 'That did not read as an image.');
    }
  }

  function paint(note) {
    if (current) {
      fill(preview, el('img', { src: current, alt: '' }),
        el('button', {
          class: 'btn ghost sm', type: 'button', title: 'Remove this screenshot',
          onclick: (e) => { e.stopPropagation(); current = ''; paint(); onChange && onChange(''); },
        }, '✕'));
      fill(zone, preview);
    } else {
      fill(zone, el('div', { class: 'pastehint' },
        el('b', {}, 'Paste a screenshot'),
        el('span', {}, 'Click here then ⌘V — or drop a file'),
      ), file);
    }
    fill(meta, note || hint || '');
  }

  const node = el('div', { class: 'field' }, el('label', {}, label), zone, meta);
  paint();
  node.value = () => current;
  node.bytes = () => dataUrlBytes(current);
  return node;
}
