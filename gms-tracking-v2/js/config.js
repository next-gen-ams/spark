/* Tracking Dashboard — configuration, vocabularies and defaults.
   Everything a non-developer might want to change lives here or in Admin. */

export const APP = {
  title: 'Tracking Dashboard',
  org: 'GMS Digital',
  sub: 'Paid performance tracking — all clients',
  // Internal-only build. Margin is visible on screen; never share this link out.
  confidential: true,
};

/* Supabase.
   Shares the uq-spark project but lives in its own `tracking` schema, behind
   its own login. Isolation is enforced in Postgres (see supabase-schema.sql):
   the UQ dashboard's accounts cannot read this schema, and this account
   cannot read theirs — verified both directions.

   teamEmail must NOT be on @gms.global / @grg.co / @uq.edu.au: the UQ
   project's is_team() matches those domains, so an address on one of them
   would inherit read access to every UQ table.

   Blank the url/anonKey to run entirely in this browser (localStorage). */
export const SUPABASE = {
  url: 'https://agpggomwormexgjzbjtv.supabase.co',
  anonKey: 'sb_publishable_QL430D--kBBmO6_jkDZW7Q_fouzRY8S',
  schema: 'tracking',
  teamEmail: 'tracking@gms-digital.internal',
};

export const CCY_DEFAULT = 'AUD';

/* Convention: 1 AUD = perAud <ccy>.  toAud(x) === x / perAud  */
export const FX_DEFAULT = {
  AUD: 1, CNY: 4.3, USD: 0.6433, HKD: 5.02,
  SGD: 0.858, JPY: 87, LKR: 210.198, KM: 3.08,
};

export const VOCAB_DEFAULT = {
  platform: ['Baidu', 'RED', 'WeChat', 'Weibo', 'Douyin', 'IQIYI', 'DSP', 'Other'],
  objective: ['Branding', 'Boosting', 'Performance', 'BAU', 'Info Day', 'Open Day',
    'Production', 'GMS Internal'],
  buy_method: ['CPM', 'CPC', 'CPE', 'Unit', 'Once Off'],
  status: ['Not started', 'Live', 'Paused', 'Stopped', 'Completed'],
};

/* Summary cards are pinned to these platforms first, in this order, then any
   other platform that actually carries spend. */
export const CARD_PLATFORMS = ['WeChat', 'RED', 'Baidu'];

export const PLATFORM_COLOR = {
  RED: '#FF2E4D', WeChat: '#1BB255', Baidu: '#2A6098', Weibo: '#E29A0E',
  Douyin: '#111111', IQIYI: '#00BE06', DSP: '#7E86C4', Other: '#8C877E',
};

/* Brand marks are vendored with V2 so the platform picker still works from
   mainland-China offices without relying on a third-party icon CDN. DSP is
   the iPinYou account in the current plans, so it intentionally carries the
   current iPinYou / DeepZero mark while its stored platform value stays DSP. */
export const PLATFORM_LOGO = {
  Baidu: 'assets/platforms/baidu.svg',
  WeChat: 'assets/platforms/wechat.svg',
  RED: 'assets/platforms/xiaohongshu.svg',
  IQIYI: 'assets/platforms/iqiyi.svg',
  DSP: 'assets/platforms/ipinyou.svg',
  IPY: 'assets/platforms/ipinyou.svg',
};

/* Raw media-plan strings → our platform vocabulary. Matched case-insensitively
   as a substring, longest key first. Unmatched values are kept verbatim. */
export const PLATFORM_ALIASES = {
  'baidu sem': 'Baidu', 'baidu': 'Baidu',
  'wechat': 'WeChat', 'weixin': 'WeChat', '微信': 'WeChat',
  'red': 'RED', 'xiaohongshu': 'RED', '小红书': 'RED',
  'weibo': 'Weibo', '微博': 'Weibo',
  'douyin': 'Douyin', 'tiktok': 'Douyin',
  'iqiyi': 'IQIYI', 'youku': 'Other',
  'dsp': 'DSP', 'stackadapt': 'DSP', 'pmp whitelisting': 'DSP',
};

/* Media-plan rows whose Category/Media matches these are imported as
   non-billable — they must not enter delivery %, pacing or cost efficiency.
   (Production lines are quoted as BONUS; GMS Internal lines carry negative
   margin because there is no client-facing cost at all.) */
export const NON_BILLABLE_HINTS = [
  'production', 'gms internal', 'freelancer', 'service fee', 'h5 page',
];

/* Media-plan rows to skip outright: roll-up rows and the split-out top-up /
   breakdown rows that restate money already counted on the parent line. */
export const SKIP_ROW_HINTS = [
  'subtotal', 'sub total', 'total', 'annual total', 'grand total',
];
export const BREAKDOWN_HINTS = ['breakdown', 'top up', 'topup', 'top-up'];

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* Pacing thresholds, as a ratio of spend progress to time progress. */
export const PACING = { under: 0.85, over: 1.15 };
