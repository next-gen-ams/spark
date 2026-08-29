/* Who is at this keyboard.
 *
 * Everyone signs in with the same team password, so Postgres cannot tell the
 * team apart — every write arrives as the same account. That is fine for the
 * numbers, which are the campaign's rather than anyone's, but not for the
 * tracking log: "client paused the push" is worth much more when you know who
 * to ask about it.
 *
 * So the name is a browser preference, not an identity. It is asked for once,
 * kept in localStorage, and stamped onto log entries as they are written. It
 * proves nothing and is not meant to — it is a byline, not an audit trail, and
 * anyone can change it. Real attribution would need real accounts, which would
 * mean everyone remembering which one is theirs, for a three-person team.
 */

const KEY = 'gms-tracking-who';

/** @returns {string} the stored name, or '' if nobody has said yet. */
export function whoAmI() {
  try {
    return (localStorage.getItem(KEY) || '').trim();
  } catch {
    return '';                       // private mode, or storage disabled
  }
}

/** Store a name, or clear it with ''. Returns what was stored. */
export function setWhoAmI(name) {
  const clean = String(name || '').trim().slice(0, 40);
  try {
    if (clean) localStorage.setItem(KEY, clean);
    else localStorage.removeItem(KEY);
  } catch { /* nothing to do; the byline is simply unavailable */ }
  return clean;
}
