import { PLATFORM_COLOR, PLATFORM_LOGO } from './config.js';
import { el } from './dom.js';

/** A compact visual account mark. The adjacent platform name remains the
 * accessible label, so the image is decorative and never read twice. */
export function platformMark(platform, extraClass = '') {
  const name = String(platform || 'Other');
  const src = PLATFORM_LOGO[name];
  const cls = `platform-brand-mark${name === 'DSP' || name === 'IPY' ? ' wide' : ''}${extraClass ? ` ${extraClass}` : ''}`;
  return el('span', {
    class: cls,
    'data-platform': name,
    style: { '--platform-color': PLATFORM_COLOR[name] || 'var(--v2-blue)' },
    'aria-hidden': 'true',
  }, src
    ? el('img', { src, alt: '', loading: 'eager', decoding: 'async' })
    : el('span', {}, name.slice(0, 2).toUpperCase()));
}
