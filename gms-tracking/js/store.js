/* Storage layer.

   Runs against localStorage out of the box so the dashboard is usable the
   moment you open it. Fill in SUPABASE.url / anonKey in config.js and the same
   API talks to Postgres instead, with per-row upserts and realtime — identical
   shape to the UQ dashboard's sync layer.                                    */

import { SUPABASE, FX_DEFAULT, VOCAB_DEFAULT } from './config.js';

export const TABLES = ['client', 'campaign', 'line', 'line_month',
  'creative', 'spend', 'vocab', 'fx', 'settings'];

const LS_KEY = 'gms-tracking-v1';

/* Not every table keys on `id` — fx is keyed by currency code and settings by
   its key name, matching the schema. Assuming `id` everywhere made upserts to
   those two fail against Postgres (dropping the app to Offline) and collide
   locally, because `undefined === undefined` matches the first row. */
const PK = { fx: 'ccy', settings: 'k' };
export const pkOf = (table) => PK[table] || 'id';

export const db = Object.fromEntries(TABLES.map((t) => [t, []]));

let sb = null;                       // supabase client, when configured
const listeners = new Set();

export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((fn) => fn());

export const state = { mode: 'local', status: 'ready', error: '', pending: 0 };

/* --------------------------------------------------------------- outbox
 *
 * Every remote write goes through a durable, strictly-ordered outbox instead
 * of fire-and-forget upserts. Two real losses forced this design:
 *
 *   1. The old retry queue held CLOSURES in memory. A write that failed (say,
 *      while a migration was missing) waited for a retry that a page refresh
 *      silently destroyed — together with the user's typing.
 *   2. Writes raced each other: a creative's insert could still be in flight
 *      when the spend row referencing it arrived, and the foreign key rejected
 *      real data for reasons of timing, not truth.
 *
 * The outbox is plain data (ops, not closures), saved to localStorage on every
 * change, replayed in FIFO order — parent before child, always — and reapplied
 * over the remote snapshot at boot, so pending work survives refreshes,
 * crashes and offline stretches. state.pending is its length, which the status
 * chip shows: queued work is visible work.
 */
const OUTBOX_KEY = 'gms-tracking-outbox-v1';
let outbox = [];
let flushing = false;

function loadOutbox() {
  try { outbox = JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]'); }
  catch { outbox = []; }
  if (!Array.isArray(outbox)) outbox = [];
  state.pending = outbox.length;
}

function saveOutbox() {
  try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox)); }
  catch (e) { console.warn('[store] outbox not saved', e); }
  state.pending = outbox.length;
}

function enqueue(op) {
  if (!sb) return;                                   // local mode has no remote
  /* Rapid retyping of one cell coalesces: if the newest queued op is an upsert
     of the same row, replace it in place instead of stacking history. */
  const last = outbox.at(-1);
  if (op.t === 'up' && last?.t === 'up' && last.table === op.table
    && last.row[pkOf(op.table)] === op.row[pkOf(op.table)]) {
    outbox[outbox.length - 1] = op;
  } else {
    outbox.push(op);
  }
  saveOutbox();
  flush();
}

function execOp(op) {
  if (op.t === 'up') return sb.from(op.table).upsert(op.row);
  if (op.t === 'upm') return sb.from(op.table).upsert(op.rows);
  if (op.t === 'del') return sb.from(op.table).delete().eq(pkOf(op.table), op.id);
  if (op.t === 'delw') return sb.from(op.table).delete().eq(op.key, op.value);
  if (op.t === 'delall') return sb.from(op.table).delete().not(pkOf(op.table), 'is', null);
  return Promise.resolve({ error: new Error(`unknown op ${op.t}`) });
}

/** Drain the outbox head-first. Stops at the first failure so order is never
    violated — a child row must not slip past its still-unsynced parent. */
async function flush() {
  if (!sb || flushing || !outbox.length) return;
  flushing = true;
  state.status = 'saving'; emit();
  try {
    while (outbox.length) {
      const { error } = await execOp(outbox[0]);
      if (error) throw error;
      outbox.shift();
      saveOutbox();
    }
    state.status = 'synced';
    state.error = '';
  } catch (e) {
    state.status = 'offline';
    state.error = e.message || String(e);
    console.warn('[store]', e);
  }
  flushing = false;
  emit();
}

/** Re-play pending local work over a freshly loaded remote snapshot, so what
    the user typed while offline is never hidden behind older server rows. */
function applyOutboxLocally() {
  for (const op of outbox) {
    if (op.t === 'up') upsertLocal(op.table, op.row);
    else if (op.t === 'upm') for (const r of op.rows) upsertLocal(op.table, r);
    else if (op.t === 'del') db[op.table] = db[op.table].filter((r) => r[pkOf(op.table)] !== op.id);
    else if (op.t === 'delw') db[op.table] = db[op.table].filter((r) => r[op.key] !== op.value);
    else if (op.t === 'delall') db[op.table] = [];
  }
}

function upsertLocal(table, row) {
  const pk = pkOf(table);
  const list = db[table];
  const i = list.findIndex((r) => r[pk] === row[pk]);
  if (i >= 0) list[i] = { ...list[i], ...row }; else list.push({ ...row });
}

/* ------------------------------------------------------------------- read */

export const all = (table) => db[table] || [];
export const byId = (table, id) => all(table).find((r) => r[pkOf(table)] === id) || null;
export const where = (table, fn) => all(table).filter(fn);

export function index(table, key) {
  const m = new Map();
  for (const r of all(table)) {
    const k = r[key];
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
}

/* ------------------------------------------------------------------ write */

export function put(table, row) {
  const pk = pkOf(table);
  if (row[pk] == null) { console.warn(`[store] ${table} row has no ${pk}`, row); return row; }
  const list = db[table];
  const i = list.findIndex((r) => r[pk] === row[pk]);
  const next = { ...(i >= 0 ? list[i] : {}), ...row };
  if (i >= 0) list[i] = next; else list.push(next);
  persist(table, next);
  emit();
  return next;
}

export function putMany(table, rows) {
  const pk = pkOf(table);
  for (const row of rows) {
    if (row[pk] == null) continue;
    const list = db[table];
    const i = list.findIndex((r) => r[pk] === row[pk]);
    if (i >= 0) list[i] = { ...list[i], ...row }; else list.push({ ...row });
  }
  persistMany(table, rows);
  emit();
}

export function remove(table, id) {
  const pk = pkOf(table);
  db[table] = db[table].filter((r) => r[pk] !== id);
  enqueue({ t: 'del', table, id });
  saveLocal();
  emit();
}

/** Delete every row of `table` whose `key` equals `value` (cascade by hand,
    so local mode behaves the same as Postgres' ON DELETE CASCADE). */
export function removeWhere(table, key, value) {
  const doomed = db[table].filter((r) => r[key] === value).map((r) => r.id);
  db[table] = db[table].filter((r) => r[key] !== value);
  enqueue({ t: 'delw', table, key, value });
  saveLocal();
  emit();
  return doomed;
}

/* The tables wipeData() empties — the *data*, as opposed to the *setup*.
   FX rates, dropdown vocabulary and settings (column-mapping memory, saved
   column widths) survive a wipe: they are how the team taught the tool to
   work, and re-teaching it is exactly the friction a fresh start should not
   carry. */
const DATA_TABLES = ['spend', 'creative', 'line_month', 'line', 'campaign', 'client'];

/**
 * Empty every data table, locally and — when signed in — in Postgres too.
 * Child tables go first so a failure part-way never leaves orphaned rows that
 * a later delete of the parent would have caught.
 * @returns {{rows: number}} how many rows went
 */
export function wipeData() {
  let rows = 0;
  for (const t of DATA_TABLES) {
    rows += db[t].length;
    db[t] = [];
    /* One statement per table, not one per row — 1,700 spend rows as
       individual deletes would sit in the queue for minutes. */
    enqueue({ t: 'delall', table: t });
  }
  /* The sample-data banner keys off these; data gone means they must go too,
     or an empty dashboard would still claim to be showing the sample. */
  for (const k of ['demo', 'demo_kind']) {
    if (!db.settings.some((s) => s.k === k)) continue;
    db.settings = db.settings.filter((s) => s.k !== k);
    enqueue({ t: 'del', table: 'settings', id: k });
  }
  saveLocal();
  emit();
  return { rows };
}

/* ------------------------------------------------------------ persistence */

function persist(table, row) {
  saveLocal();
  enqueue({ t: 'up', table, row });
}

function persistMany(table, rows) {
  saveLocal();
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += 400) {
    enqueue({ t: 'upm', table, rows: rows.slice(i, i + 400) });
  }
}

function saveLocal() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(db));
  } catch (e) {
    state.error = 'Local storage is full — export a backup and clear old campaigns.';
    console.warn(e);
  }
}

/* ------------------------------------------------------------------- boot */

export async function init() {
  loadLocal();
  loadOutbox();
  seed();

  /* First run with no backend: load the demo built from the three real media
     plans, so the dashboard opens with something to look at. Clearly flagged
     as demo — Admin ▸ Data can reload or clear it. */
  if (!db.line.length && !(SUPABASE.url && SUPABASE.anonKey)) {
    await loadDemo();
  }

  if (SUPABASE.url && SUPABASE.anonKey && window.supabase) {
    state.mode = 'supabase';
    sb = window.supabase.createClient(SUPABASE.url, SUPABASE.anonKey, {
      db: { schema: SUPABASE.schema || 'public' },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        /* The UQ dashboard lives in the same Supabase project, so by default
           both apps share one session key in localStorage — open this page
           after signing into that one and you inherit ITS account, which RLS
           then correctly denies, leaving a page that says "synced" and shows
           nothing. Separate storage keys keep the two logins independent. */
        storageKey: `sb-${SUPABASE.schema || 'public'}-auth`,
      },
    });
    const { data } = await sb.auth.getSession();
    if (data?.session && sessionMatches(data.session)) await loadRemote();
    else if (data?.session) { await sb.auth.signOut(); state.status = 'locked'; }
    else state.status = 'locked';
  } else {
    state.mode = 'local';
    state.status = 'local';
  }
  emit();
}

/** The signed-in identity must be the one the RLS policy names, or every
    query silently returns zero rows instead of failing. */
function sessionMatches(session) {
  const email = session?.user?.email;
  return !SUPABASE.teamEmail || email === SUPABASE.teamEmail;
}

export async function signIn(password) {
  if (!sb) return { ok: true };                     // local mode needs no gate
  const { error } = await sb.auth.signInWithPassword({
    email: SUPABASE.teamEmail, password,
  });
  if (error) return { ok: false, error: error.message };
  await loadRemote();
  return { ok: true };
}

export async function signOut() {
  if (sb) await sb.auth.signOut();
  state.status = 'locked';
  emit();
}

/* PostgREST caps every query at 1,000 rows and says nothing about it. With
   1,700 spend rows in production, a plain select('*') silently dropped the
   newest 700 on every refresh — the user's fresh entries vanished from the
   screen while sitting safely in Postgres, and saveLocal() then overwrote the
   local copy with the truncated snapshot. Every table is paged to the end. */
const PAGE = 1000;

/* Columns deliberately left out of the boot read.
 *
 * creative.preview_image holds a pasted screenshot. Even downscaled it is tens
 * of kilobytes, and `select('*')` would drag every image down on every page
 * load for a thumbnail almost nobody is looking at right then. It is fetched
 * on demand instead — when a drawer opens, or when an export needs it. */
const SELECT_COLS = {
  creative: 'id,line_id,name,live_from,live_to,preview_url,status,note,updated_at',
};

async function fetchAll(t) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from(t).select(SELECT_COLS[t] || '*')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

/**
 * Pull the pasted thumbnails for a set of creatives and merge them into the
 * local rows. Safe to call repeatedly: anything already loaded is skipped, and
 * in local mode the images are in the row already so it is a no-op.
 * @param {string[]} ids
 */
export async function loadCreativeImages(ids) {
  const want = [...new Set(ids)].filter((id) => {
    const c = byId('creative', id);
    return c && c.preview_image === undefined;
  });
  if (!sb || !want.length) return;
  for (let i = 0; i < want.length; i += 50) {
    const chunk = want.slice(i, i + 50);
    const { data, error } = await sb.from('creative')
      .select('id,preview_image').in('id', chunk);
    if (error) { console.warn('[store] thumbnails unavailable', error); return; }
    for (const row of data || []) {
      const c = byId('creative', row.id);
      /* null, not undefined — "asked and there is none" must be
         distinguishable from "never asked", or every render re-fetches. */
      if (c) c.preview_image = row.preview_image ?? null;
    }
  }
  saveLocal();
  emit();
}

async function loadRemote() {
  state.status = 'loading'; emit();
  try {
    let received = 0;
    for (const t of TABLES) {
      db[t] = await fetchAll(t);
      received += db[t].length;
    }
    /* Row-level security denies by returning nothing, not by erroring. An
       empty read on a signed-in session means the wrong account, so say so
       rather than rendering a convincingly empty dashboard. */
    const { data: s2 } = await sb.auth.getSession();
    if (!received && s2?.session && !sessionMatches(s2.session)) {
      throw new Error(`Signed in as ${s2.session.user?.email} — that account cannot read this dashboard.`);
    }
    /* Anything still in the outbox is newer than the snapshot we just loaded —
       replay it on top, or the refresh would hide the user's own typing. */
    applyOutboxLocally();
    seed();
    saveLocal();
    state.status = 'synced';
    if (typeof sb.channel === 'function') subscribe();
    flush();
  } catch (e) {
    state.status = 'offline';
    state.error = e.message || String(e);
  }
  emit();
}

/* Test seam: the sync layer is exactly where "works on my machine" hides, so
   the suite drives it with a scripted client. Not part of the app's API. */
export const _sync = {
  setClient: (fake) => { sb = fake; },
  outbox: () => outbox.map((o) => ({ ...o })),
  clearOutbox: () => { outbox = []; saveOutbox(); },
  flush,
  loadRemote,
  loadOutbox,
};

function subscribe() {
  sb.channel('tracking')
    .on('postgres_changes', { event: '*', schema: SUPABASE.schema || 'public' }, (p) => {
      const t = p.table;
      if (!db[t]) return;
      const pk = pkOf(t);
      if (p.eventType === 'DELETE') db[t] = db[t].filter((r) => r[pk] !== p.old[pk]);
      else {
        const i = db[t].findIndex((r) => r[pk] === p.new[pk]);
        if (i >= 0) db[t][i] = p.new; else db[t].push(p.new);
      }
      saveLocal();
      emit();
    })
    .subscribe();
}

/** Demo dataset — built by `node tools/build-demo.mjs` from the real plans. */
export async function loadDemo() {
  try {
    const res = await fetch('data/demo.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`demo.json ${res.status}`);
    const parsed = await res.json();
    for (const t of TABLES) if (Array.isArray(parsed[t])) db[t] = parsed[t];
    seed();
    saveLocal();
    /* With a backend configured, loading the sample must reach it too —
       otherwise the button appears to work and silently changes nothing for
       anyone else on the team. */
    if (sb) for (const t of TABLES) persistMany(t, db[t]);
    emit();
    return true;
  } catch (e) {
    console.warn('[store] demo data unavailable', e);
    return false;
  }
}

export const isDemo = () =>
  all('settings').some((s) => s.k === 'demo' && String(s.v) === 'true');

function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    for (const t of TABLES) if (Array.isArray(parsed[t])) db[t] = parsed[t];
  } catch (e) { console.warn('[store] local read failed', e); }
}

function seed() {
  if (!db.fx.length) {
    db.fx = Object.entries(FX_DEFAULT).map(([ccy, per_aud]) => ({ ccy, per_aud }));
  }
  if (!db.vocab.length) {
    db.vocab = Object.entries(VOCAB_DEFAULT).flatMap(([kind, vals]) =>
      vals.map((value, i) => ({ id: `${kind}:${value}`, kind, value, sort: i, active: true })));
  }
}

/* ---------------------------------------------------------------- helpers */

export const fxMap = () =>
  Object.fromEntries(all('fx').map((r) => [r.ccy || r.id, Number(r.per_aud)]));

export const vocab = (kind) => all('vocab')
  .filter((v) => v.kind === kind && v.active !== false)
  .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
  .map((v) => v.value);

export function addVocab(kind, value) {
  const v = String(value || '').trim();
  if (!v || vocab(kind).includes(v)) return v;
  put('vocab', { id: `${kind}:${v}`, kind, value: v, sort: 999, active: true });
  return v;
}

let idSeq = 0;
export const newId = (prefix) =>
  `${prefix}_${Date.now().toString(36)}${(idSeq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/* ------------------------------------------------------------ backup / io */

export const exportJson = () => JSON.stringify(db, null, 2);

export function importJson(text) {
  const parsed = JSON.parse(text);
  for (const t of TABLES) if (Array.isArray(parsed[t])) db[t] = parsed[t];
  saveLocal();
  if (sb) for (const t of TABLES) persistMany(t, db[t]);
  emit();
}

export function wipe() {
  for (const t of TABLES) db[t] = [];
  seed();
  saveLocal();
  emit();
}
