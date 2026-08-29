/* Working out which spreadsheet column is which.
 *
 * Three passes, in descending order of trust:
 *
 *   1. remembered  — a header text this team has mapped before
 *   2. header      — the header text matches a known name or synonym
 *   3. inferred    — the header is unrecognised, so look at the DATA:
 *                    a margin column is the one whose values equal
 *                    (gms − media) / gms, a buy-method column is the one full
 *                    of CPM/CPC, and so on.
 *
 * Anything still unresolved is handed to the user to point at. Nothing is
 * guessed silently — every field carries the source it was resolved by.
 */

const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

/** The fields the tracker needs, in the order the mapping panel shows them. */
export const FIELDS = [
  { key: 'category', label: 'Category / Media', kind: 'text', required: true,
    help: 'The platform or line name — Baidu SEM, WeChat, RED…' },
  { key: 'cost_media', label: 'Net media cost', kind: 'num', required: true,
    help: 'Internal — what GMS pays the media owner.' },
  { key: 'cost_gms', label: 'Net GMS cost', kind: 'num', required: true,
    help: 'Client-facing — what the client is billed.' },
  { key: 'margin_pct', label: 'Margin %', kind: 'pct', derivable: true,
    help: 'Read off the plan. If missing it is computed from the two costs above.' },
  { key: 'buy_method', label: 'Buying method', kind: 'enum',
    help: 'CPM / CPC / Unit — decides how cost efficiency is calculated.' },
  { key: 'rate_media', label: 'Unit rate to media', kind: 'num' },
  { key: 'rate_gms', label: 'Unit rate to GMS', kind: 'num' },
  { key: 'booked_units', label: 'Total units', kind: 'num' },
  { key: 'est_units', label: 'Est. impressions / clicks', kind: 'num' },
  { key: 'currency', label: 'Currency', kind: 'ccy' },
  { key: 'supplier', label: 'Supplier', kind: 'text' },
  { key: 'market', label: 'Market', kind: 'text' },
  { key: 'placement', label: 'Placement', kind: 'text' },
  { key: 'rationale', label: 'Description / rationale', kind: 'text' },
  { key: 'landing_page', label: 'Landing page', kind: 'text' },
  { key: 'kpi', label: 'KPI', kind: 'text' },
];

export const FIELD = Object.fromEntries(FIELDS.map((f) => [f.key, f]));
export const REQUIRED = FIELDS.filter((f) => f.required).map((f) => f.key);

/** Header synonyms. Longest match wins, so 'margin %' beats 'margin'. */
const SYNONYMS = {
  category: ['category/media', 'category / media', 'category', 'media', '媒体', '渠道'],
  supplier: ['supplier', 'media owner', 'vendor', 'partner', '供应商'],
  market: ['market', 'country', 'region', '市场', '国家'],
  placement: ['placement', 'ad format', 'format', 'ad placement', '广告位'],
  rationale: ['description/ rationale', 'description / rationale', 'description', 'rationale', 'remark', 'notes'],
  rate_media: ['unit rate to media', 'media unit rate', 'rate to media', 'cost rate', 'net rate', '媒体单价'],
  rate_gms: ['unit rate to gms', 'unit rate to client', 'gms unit rate', 'rate to gms',
    'rate to client', 'sell rate', 'client rate', '客户单价'],
  buy_method: ['buying method', 'buy method', 'buying type', 'pricing model', 'cost model', '购买方式'],
  landing_page: ['landing page', 'lp', 'destination url'],
  kpi: ['kpi', 'objective kpi', 'success metric'],
  booked_units: ['total unit/impression/click', 'total unit/impression/clicks',
    'total unit', 'total units', 'volume', 'booked units', '总量'],
  est_units: ['est. impression / clicks', 'est. impression', 'est impression',
    'estimated impressions', 'est. impressions/clicks', 'impressions'],
  currency: ['currency', 'ccy', '币种'],
  cost_media: ['net media cost', 'media cost', 'net cost', 'cost to media', '媒体成本'],
  cost_gms: ['net gms cost', 'net client cost', 'gms cost', 'client cost', 'gross cost', '客户金额'],
  margin: ['margin'],
  margin_pct: ['margin %', 'margin%', 'margin pct', 'margin rate', '毛利率'],
};

/* ------------------------------------------------------------------ pass 1 */

const MEM_PREFIX = 'colmap:';

/** Header text this team has already mapped, from the settings table. */
export function rememberedMap(settings) {
  const out = {};
  for (const s of settings || []) {
    if (typeof s.k === 'string' && s.k.startsWith(MEM_PREFIX) && s.v) {
      out[s.k.slice(MEM_PREFIX.length)] = s.v;
    }
  }
  return out;
}

export const memoryKey = (headerText) => MEM_PREFIX + norm(headerText);

/* ------------------------------------------------------------------ pass 2 */

/** Match a header against the synonym table. Returns a field key or ''. */
export function fieldForHeader(headerText) {
  const label = norm(headerText);
  if (!label) return '';
  let best = '', bestLen = 0;
  for (const [key, names] of Object.entries(SYNONYMS)) {
    for (const n of names) {
      const hit = label === n || label.startsWith(n + ' ') || label === n + ':';
      if (hit && n.length > bestLen) { best = key; bestLen = n.length; }
    }
  }
  return best === 'margin' ? '' : best;      // bare 'margin' is the $ column, not %
}

/* --------------------------------------------------------- column profiles */

/**
 * A snapshot of every column below the header — enough for both the inference
 * rules and the sample values shown in the mapping panel.
 */
export function profileColumns(ws, headerRow, readCell, lastRow) {
  const end = Math.min(lastRow ?? ws.rowCount, headerRow + 200);
  const out = [];
  for (let c = 1; c <= ws.columnCount; c++) {
    const header = String(readCell(headerRow, c) ?? '').trim();
    const values = [];
    const nums = [];
    const texts = [];
    for (let r = headerRow + 1; r <= end; r++) {
      const v = readCell(r, c);
      if (v == null || v === '') continue;
      const t = String(v).trim();
      /* A vertically merged header repeats itself on the row below, and plans
         fill empty cells with a dash. Neither is data. */
      if (t === header || PLACEHOLDER.test(t)) continue;
      values.push(v);
      const n = typeof v === 'number' ? v : parseFloat(t.replace(/[,$%\s]/g, ''));
      if (Number.isFinite(n)) nums.push({ row: r, n });
      else texts.push({ row: r, t });
    }
    if (!header && !values.length) continue;
    out.push({
      col: c, header,
      samples: values.slice(0, 3).map((v) => String(v).slice(0, 28)),
      count: values.length, nums, texts,
      numericRatio: values.length ? nums.length / values.length : 0,
    });
  }
  return out;
}

export const colLetter = (n) => {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; }
  return s;
};

/* ------------------------------------------------------------------ pass 3 */

/* Not data: dashes and "TBC" stand in for an empty cell, and a merged
   Subtotal / Total label bleeds sideways across the whole roll-up row. */
const PLACEHOLDER = /^(-+|—+|n\/?a|tbc|tbd|\.|sub ?total|grand total|annual total|total)$/i;
const METHODS = /^(cpm|cpc|cpe|cpa|cpv|cpl|unit|once off|onceoff|flat|fixed|package)$/i;
const CCY = /^[A-Z]{3}$/;

const median = (nums) => {
  if (!nums.length) return 0;
  const v = nums.map((x) => x.n).sort((a, b) => a - b);
  const mid = v.length >> 1;
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
};

/**
 * Infer the still-unmapped fields from the data itself.
 *
 * This is the pass that saves a plan whose headers we've never seen. It is
 * deliberately conservative: a rule fires only when it holds for most of the
 * rows, and it never overwrites a field that was already resolved.
 *
 * @returns {object} { field: {col, source, why} } for newly resolved fields
 */
export function inferColumns(profiles, resolved) {
  const found = {};
  const taken = new Set(Object.values(resolved).filter(Boolean));
  const free = (p) => !taken.has(p.col);
  const claim = (key, p, why) => {
    found[key] = { col: p.col, source: 'inferred', why };
    taken.add(p.col);
  };
  const need = (key) => !resolved[key] && !found[key];
  const colOf = (key) => resolved[key] ?? found[key]?.col ?? null;
  const at = (p, row) => p.nums.find((x) => x.row === row)?.n;

  /* --- buying method: a column of CPM / CPC / Unit ---------------------- */
  if (need('buy_method')) {
    const hit = profiles.filter(free).find((p) =>
      p.texts.length >= 2 && p.texts.filter((t) => METHODS.test(t.t)).length / p.texts.length > 0.6);
    if (hit) claim('buy_method', hit, 'values are CPM / CPC / Unit');
  }

  /* --- currency: a column of three-letter codes ------------------------- */
  if (need('currency')) {
    const hit = profiles.filter(free).find((p) =>
      p.texts.length >= 2 && p.texts.filter((t) => CCY.test(t.t)).length / p.texts.length > 0.8);
    if (hit) claim('currency', hit, 'values are 3-letter currency codes');
  }

  /* --- the two cost columns and the margin, solved together ------------ *
     A media plan contains several numeric columns that look like a plausible
     cost pair — including the MARGIN dollar column, which sits between them
     and will happily pass a "one is a grossed-up version of the other" test.
     What is NOT a coincidence is the three-way identity:

         media = client × (1 − margin%)

     Solving for the whole triple at once is what tells MARGIN $ apart from
     Net Media Cost. Columns already resolved by header still take part, so a
     known margin% column can pin down two unknown cost columns.            */
  if (need('cost_media') || need('cost_gms') || need('margin_pct')) {
    const money = profiles.filter((p) => p.numericRatio > 0.6 && p.nums.length >= 3);
    const pcts = profiles.filter((p) =>
      p.nums.length >= 2 && p.nums.every((x) => x.n >= 0 && x.n < 1));

    let best = null;
    for (const g of money) {
      for (const m of money) {
        if (g.col === m.col) continue;
        for (const pc of pcts) {
          if (pc.col === g.col || pc.col === m.col) continue;
          let agree = 0, rows = 0;
          for (const { row, n: pct } of pc.nums) {
            const hi = at(g, row); const lo = at(m, row);
            if (hi == null || lo == null || hi <= 0) continue;
            rows++;
            if (Math.abs(lo - hi * (1 - pct)) <= Math.max(0.02, hi * 0.005)) agree++;
          }
          if (rows >= 2 && agree / rows > 0.8 && (!best || agree > best.agree)) {
            best = { g, m, pc, agree };
          }
        }
      }
    }

    if (best) {
      const why = 'media = client × (1 − margin) holds across the sheet';
      if (need('cost_media') && free(best.m)) claim('cost_media', best.m, why);
      if (need('cost_gms') && free(best.g)) claim('cost_gms', best.g, why);
      if (need('margin_pct') && free(best.pc)) claim('margin_pct', best.pc, why);
    }
  }

  /* --- margin alone, when the costs are known but the % column is not ---- */
  if (need('margin_pct')) {
    const mCol = profiles.find((p) => p.col === colOf('cost_media'));
    const gCol = profiles.find((p) => p.col === colOf('cost_gms'));
    const inRange = profiles.filter(free).filter((p) =>
      p.nums.length >= 2 && p.nums.every((x) => x.n >= 0 && x.n < 1));
    if (mCol && gCol) {
      const hit = inRange.find((p) => {
        let agree = 0, rows = 0;
        for (const { row, n } of p.nums) {
          const lo = at(mCol, row); const hi = at(gCol, row);
          if (lo == null || hi == null || hi <= 0) continue;
          rows++;
          if (Math.abs(n - (hi - lo) / hi) < 0.01) agree++;
        }
        return rows >= 2 && agree / rows > 0.8;
      });
      if (hit) claim('margin_pct', hit, 'equals (client − media) ÷ client on every row');
    }
  }

  /* --- unit rate and volume, solved as a pair ---------------------------- *
     rate × units = cost (÷1000 for CPM). Neither column can be identified on
     its own, but the pair that satisfies the identity against a known cost
     column is unambiguous — so solve for both at once.                      */
  const holds = (rate, units, cost) => {
    if (!rate || !units || !cost) return false;
    const cpc = Math.abs(rate * units - cost) / cost;
    const cpm = Math.abs((rate * units) / 1000 - cost) / cost;
    return Math.min(cpc, cpm) < 0.05;       // plans carry small top-up loadings
  };

  for (const [rateKey, costKey] of [['rate_media', 'cost_media'], ['rate_gms', 'cost_gms']]) {
    if (!need(rateKey)) continue;
    const costCol = profiles.find((p) => p.col === colOf(costKey));
    if (!costCol) continue;

    const known = profiles.find((p) => p.col === colOf('booked_units'));
    const unitCands = known ? [known] : profiles.filter(free).filter((p) => p.nums.length >= 2);
    const rateCands = profiles.filter(free).filter((p) => p.numericRatio > 0.5 && p.nums.length >= 2);

    let best = null;
    for (const u of unitCands) {
      for (const r of rateCands) {
        if (r.col === u.col) continue;
        /* rate × units = cost is symmetric, so the identity alone cannot say
           which column is which. A unit rate is always the smaller of the two
           by a wide margin — $3 against three million impressions. */
        if (median(r.nums) >= median(u.nums)) continue;
        let agree = 0, rows = 0;
        for (const { row, n: rate } of r.nums) {
          const cost = at(costCol, row); const units = at(u, row);
          if (!cost || !units) continue;
          rows++;
          if (holds(rate, units, cost)) agree++;
        }
        if (rows >= 2 && agree / rows > 0.6 && (!best || agree > best.agree)) {
          best = { r, u, agree };
        }
      }
    }
    if (!best) continue;
    claim(rateKey, best.r, 'rate × units reproduces the cost on this column');
    if (need('booked_units') && free(best.u)) {
      claim('booked_units', best.u, 'rate × units reproduces the cost');
    }
  }

  /* --- text columns: fill the leftmost unclaimed ones in plan order ------ */
  if (need('category')) {
    const hit = profiles.filter(free).find((p) => p.texts.length >= 3 && p.numericRatio < 0.3);
    if (hit) claim('category', hit, 'the first mostly-text column');
  }

  return found;
}

/* --------------------------------------------------------------- assembly */

/**
 * Resolve every field for a sheet.
 * @returns {{cols: object, mapping: object, missing: string[]}}
 */
export function resolveColumns(ws, headerRow, readCell, { memory = {}, overrides = {} } = {}) {
  const profiles = profileColumns(ws, headerRow, readCell);
  const cols = {};
  const mapping = {};
  const used = new Set();

  const set = (key, col, source, why) => {
    if (col == null || cols[key] != null) return;
    cols[key] = col;
    mapping[key] = { col, source, why };
    used.add(col);
  };

  /* 1 — what the team has mapped before */
  for (const p of profiles) {
    const key = memory[norm(p.header)];
    if (key && FIELD[key] && !used.has(p.col)) set(key, p.col, 'remembered', `“${p.header}” was mapped here before`);
  }

  /* 2 — header text */
  for (const p of profiles) {
    if (used.has(p.col)) continue;
    const key = fieldForHeader(p.header);
    if (key && FIELD[key]) set(key, p.col, 'header', `header reads “${p.header}”`);
  }

  /* 3 — the data itself */
  for (const [key, hit] of Object.entries(inferColumns(profiles, cols))) {
    set(key, hit.col, hit.source, hit.why);
  }

  /* 4 — anything the user pinned by hand wins outright */
  for (const [key, col] of Object.entries(overrides)) {
    if (col === '' || col == null) { delete cols[key]; delete mapping[key]; continue; }
    const n = Number(col);
    for (const [k, v] of Object.entries(cols)) if (v === n && k !== key) { delete cols[k]; delete mapping[k]; }
    cols[key] = n;
    mapping[key] = { col: n, source: 'manual', why: 'you pointed at this column' };
  }

  const missing = REQUIRED.filter((k) => cols[k] == null);
  return { cols, mapping, profiles, missing };
}
