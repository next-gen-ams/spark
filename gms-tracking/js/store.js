/* Storage layer.

   Runs against localStorage out of the box so the dashboard is usable the
   moment you open it. Fill in SUPABASE.url / anonKey in config.js and the same
   API talks to Postgres instead, with per-row upserts and realtime — identical
   shape to the UQ dashboard's sync layer.                                    */

import { SUPABASE, FX_DEFAULT, VOCAB_DEFAULT } from './config.js';

export const TABLES = ['client', 'campaign', 'line', 'line_month',
  'creative', 'spend', 'vocab', 'fx', 'settings'];

const LS_KEY = 'gms-tracking-v1';

export const db = Object.fromEntries(TABLES.map((t) => [t, []]));

let sb = null;                       // supabase client, when configured
let queue = [];                      // writes waiting on a reconnect
const listeners = new Set();

export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((fn) => fn());

export const state = { mode: 'local', status: 'ready', error: '' };

/* ------------------------------------------------------------------- read */

export const all = (table) => db[table] || [];
export const byId = (table, id) => all(table).find((r) => r.id === id) || null;
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
  const list = db[table];
  const i = list.findIndex((r) => r.id === row.id);
  const next = { ...(i >= 0 ? list[i] : {}), ...row };
  if (i >= 0) list[i] = next; else list.push(next);
  persist(table, next);
  emit();
  return next;
}

export function putMany(table, rows) {
  for (const row of rows) {
    const list = db[table];
    const i = list.findIndex((r) => r.id === row.id);
    if (i >= 0) list[i] = { ...list[i], ...row }; else list.push({ ...row });
  }
  persistMany(table, rows);
  emit();
}

export function remove(table, id) {
  db[table] = db[table].filter((r) => r.id !== id);
  if (sb) run(() => sb.from(table).delete().eq('id', id));
  saveLocal();
  emit();
}

/** Delete every row of `table` whose `key` equals `value` (cascade by hand,
    so local mode behaves the same as Postgres' ON DELETE CASCADE). */
export function removeWhere(table, key, value) {
  const doomed = db[table].filter((r) => r[key] === value).map((r) => r.id);
  db[table] = db[table].filter((r) => r[key] !== value);
  if (sb) run(() => sb.from(table).delete().eq(key, value));
  saveLocal();
  emit();
  return doomed;
}

/* ------------------------------------------------------------ persistence */

function persist(table, row) {
  saveLocal();
  if (sb) run(() => sb.from(table).upsert(row));
}

function persistMany(table, rows) {
  saveLocal();
  if (sb && rows.length) {
    for (let i = 0; i < rows.length; i += 400) {
      const chunk = rows.slice(i, i + 400);
      run(() => sb.from(table).upsert(chunk));
    }
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

async function run(fn) {
  state.status = 'saving'; emit();
  try {
    const { error } = await fn();
    if (error) throw error;
    state.status = 'synced';
    if (queue.length) { const q = queue; queue = []; for (const f of q) await run(f); }
  } catch (e) {
    queue.push(fn);
    state.status = 'offline';
    state.error = e.message || String(e);
    console.warn('[store]', e);
  }
  emit();
}

/* ------------------------------------------------------------------- boot */

export async function init() {
  loadLocal();
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
      auth: { persistSession: true, autoRefreshToken: true },
    });
    const { data } = await sb.auth.getSession();
    if (data?.session) await loadRemote();
    else state.status = 'locked';
  } else {
    state.mode = 'local';
    state.status = 'local';
  }
  emit();
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

async function loadRemote() {
  state.status = 'loading'; emit();
  try {
    for (const t of TABLES) {
      const { data, error } = await sb.from(t).select('*');
      if (error) throw error;
      db[t] = data || [];
    }
    seed();
    saveLocal();
    state.status = 'synced';
    subscribe();
  } catch (e) {
    state.status = 'offline';
    state.error = e.message || String(e);
  }
  emit();
}

function subscribe() {
  sb.channel('tracking')
    .on('postgres_changes', { event: '*', schema: SUPABASE.schema || 'public' }, (p) => {
      const t = p.table;
      if (!db[t]) return;
      if (p.eventType === 'DELETE') db[t] = db[t].filter((r) => r.id !== p.old.id);
      else {
        const i = db[t].findIndex((r) => r.id === p.new.id);
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
    db.fx = Object.entries(FX_DEFAULT).map(([ccy, per_aud]) => ({ id: ccy, ccy, per_aud }));
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
