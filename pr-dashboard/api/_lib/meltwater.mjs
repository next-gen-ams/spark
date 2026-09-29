const API_BASE = 'https://api.meltwater.com';

const TOPIC_LABELS = {
  colleges_and_universities: 'Colleges & universities',
  study_abroad: 'Study abroad',
  machine_learning_and_artificial_intelligence: 'AI & machine learning',
  art_museums_and_galleries: 'Arts & galleries',
  architecture: 'Architecture',
  design: 'Design',
  visual_arts_and_design_education: 'Design education',
  fashion_designers_and_collections: 'Fashion design',
  standardized_and_admissions_tests: 'Admissions',
};

export function getThreeMonthRange(now = new Date()) {
  const end = new Date(now);
  const start = new Date(now);
  start.setUTCMonth(start.getUTCMonth() - 3);
  return {
    start: toApiDate(start),
    end: toApiDate(end),
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

function toApiDate(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, '');
}

export async function fetchMeltwaterDashboard({ apiKey, searchId, now = new Date(), fetchImpl = fetch }) {
  if (!apiKey) throw new Error('MELTWATER_API_KEY is not configured');
  const range = getThreeMonthRange(now);
  const commonParams = new URLSearchParams({
    start: range.start,
    end: range.end,
    tz: 'Australia/Melbourne',
  });

  const [searchResponse, analytics, topicsResponse, mentionsResponse, reachResponse] = await Promise.all([
    apiRequest(fetchImpl, apiKey, `/v3/searches/${searchId}`),
    apiRequest(fetchImpl, apiKey, `/v3/analytics/${searchId}?${commonParams}`),
    apiRequest(fetchImpl, apiKey, `/v3/analytics/${searchId}/top_topics?${commonParams}&size=12`),
    apiRequest(fetchImpl, apiKey, `/v3/search/${searchId}`, {
      method: 'POST',
      body: JSON.stringify({
        start: range.start,
        end: range.end,
        page: 1,
        page_size: 24,
        sort_by: 'date',
        sort_order: 'desc',
        tz: 'Australia/Melbourne',
        template: { name: 'api.json' },
      }),
    }),
    apiRequest(fetchImpl, apiKey, `/v3/analytics/${searchId}/custom`, {
      method: 'POST',
      timeoutMs: 45_000,
      body: JSON.stringify({
        start: range.start,
        end: range.end,
        tz: 'Australia/Melbourne',
        analysis: {
          type: 'measure_statistics',
          measures: ['reach', 'estimated_views'],
        },
      }),
    }).catch(() => ({})),
  ]);

  const peakDays = selectPeakDays(analytics.time_series || [], 3);
  const peakResults = await Promise.all(peakDays.map(async (peak) => {
    const dayRange = getDayRange(peak.date);
    try {
      const response = await apiRequest(fetchImpl, apiKey, `/v3/search/${searchId}`, {
        method: 'POST',
        body: JSON.stringify({
          start: dayRange.start,
          end: dayRange.end,
          page: 1,
          page_size: 4,
          sort_by: 'reach',
          sort_order: 'desc',
          tz: 'Australia/Melbourne',
          template: { name: 'api.json' },
        }),
      });
      return {
        ...peak,
        documents: response.result?.documents || [],
      };
    } catch {
      return { ...peak, documents: [] };
    }
  }));

  return normalizeDashboard({
    search: searchResponse.search,
    analytics,
    topics: topicsResponse.topics,
    documents: mentionsResponse.result?.documents,
    reachAnalytics: reachResponse,
    peakResults,
    range,
    generatedAt: now.toISOString(),
  });
}

async function apiRequest(fetchImpl, apiKey, endpoint, options = {}) {
  const { timeoutMs = 20_000, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${API_BASE}${endpoint}`, {
      ...fetchOptions,
      headers: {
        Accept: 'application/json',
        apikey: apiKey,
        ...(fetchOptions.body ? { 'Content-Type': 'application/json' } : {}),
        ...fetchOptions.headers,
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Meltwater request failed with status ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export function normalizeDashboard({ search = {}, analytics = {}, topics = [], documents = [], reachAnalytics = {}, peakResults = [], range, generatedAt }) {
  const sentiment = analytics.sentiment || {};
  const reach = reachAnalytics.result?.analysis || {};
  const trend = (analytics.time_series || []).map((item) => ({
    date: item.date,
    count: numberOrZero(item.document_count),
  }));

  return {
    meta: {
      searchId: search.id ?? null,
      searchName: String(search.name || 'RMIT China DSC').trim(),
      rangeLabel: 'Past 3 months',
      start: range.startIso,
      end: range.endIso,
      generatedAt,
    },
    summary: {
      totalMentions: numberOrZero(analytics.volume?.document_count),
      averagePerDay: numberOrZero(analytics.volume?.per_day),
      positive: numberOrZero(sentiment.positive?.document_count),
      positivePercent: numberOrZero(sentiment.positive?.percentage),
      neutral: numberOrZero(sentiment.neutral?.document_count),
      neutralPercent: numberOrZero(sentiment.neutral?.percentage),
      negative: numberOrZero(sentiment.negative?.document_count),
      negativePercent: numberOrZero(sentiment.negative?.percentage),
      potentialReach: numberOrZero(reach.reach?.sum),
      estimatedViews: numberOrZero(reach.estimated_views?.sum),
    },
    trend,
    topics: selectTopics(topics),
    mentions: documents.map(normalizeMention).filter((mention) => mention.title && mention.url),
    peaks: peakResults.map((peak) => ({
      date: peak.date,
      count: numberOrZero(peak.count),
      mentions: (peak.documents || []).map(normalizeMention).filter((mention) => mention.title && mention.url),
    })),
  };
}

function selectPeakDays(timeSeries, limit) {
  return timeSeries
    .map((item) => ({ date: item.date, count: numberOrZero(item.document_count) }))
    .filter((item) => item.date && item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function getDayRange(dateString) {
  const start = new Date(`${dateString}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return {
    start: `${dateString}T00:00:00`,
    end: toApiDate(end),
  };
}

function selectTopics(topics) {
  const leaves = [];
  const visit = (topic) => {
    if (Array.isArray(topic.sub_topics) && topic.sub_topics.length) {
      topic.sub_topics.forEach(visit);
      return;
    }
    if (topic.document_count) leaves.push(topic);
  };
  topics.forEach(visit);

  return leaves
    .filter((topic) => TOPIC_LABELS[topic.topic])
    .sort((a, b) => numberOrZero(b.document_count) - numberOrZero(a.document_count))
    .slice(0, 6)
    .map((topic) => ({
      name: TOPIC_LABELS[topic.topic] || topic.display_name || topic.topic,
      count: numberOrZero(topic.document_count),
      percentage: numberOrZero(topic.percentage),
    }));
}

function normalizeMention(document) {
  const matchedKeywords = Array.isArray(document.matched?.keywords) ? document.matched.keywords : [];
  const title = cleanText(document.content?.title || document.content?.opening_text || 'Untitled mention');
  return {
    id: String(document.id || document.external_id || ''),
    title,
    titleEn: translateTitle(title),
    source: cleanText(document.source?.name || document.source?.domain || 'Unknown source'),
    sourceType: cleanText(document.source?.information_type || document.source?.type || 'Mention'),
    url: safeUrl(document.url),
    publishedDate: document.published_date || document.indexed_date || null,
    sentiment: ['positive', 'negative', 'neutral'].includes(document.enrichments?.sentiment)
      ? document.enrichments.sentiment
      : 'neutral',
    language: cleanText(document.enrichments?.language_code || ''),
    matchedKeywords: matchedKeywords.slice(0, 6).map(cleanText),
    hitSentence: cleanText(document.matched?.hit_sentence || '').slice(0, 280),
    reach: numberOrZero(document.source?.metrics?.reach),
    estimatedViews: numberOrZero(document.metrics?.estimated_views),
  };
}

function translateTitle(title) {
  const normalized = title.replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
  if (normalized.includes('下一代设计，正在北京发生')) {
    return 'The Next Generation of Design Is Taking Shape in Beijing';
  }
  if (normalized.includes('澳大利亚皇家墨尔本理工大学代表团到访成都东软学院')) {
    return 'RMIT University Delegation Visits Chengdu Neusoft University';
  }
  if (normalized.includes('北京时装周青年设计师扶持计划')) {
    return 'Beijing Fashion Week Emerging Designer Program Creates a Stage for New Talent';
  }
  if (normalized.includes('下一种风格，正在成形')) {
    return 'BFW NEXT | The Next Style Is Taking Shape';
  }
  if (normalized.includes('从"建造"到"创造"')) {
    return 'From “Building” to “Creating”: New Questions for Art and Design Education Amid Urban and Industrial Change';
  }
  if (normalized.includes('澳洲游戏设计专业研究生留学申请方法')) {
    return '2026 Update: How to Apply for Postgraduate Game Design Study in Australia';
  }
  if (normalized.includes('外滩大会首次设立AI艺术节')) {
    return 'The Inclusion Conference on the Bund Launches Its First AI Arts Festival';
  }
  if (normalized.includes('AI艺人开唱、顶尖数字艺术家集结')) {
    return 'AI Performers, Leading Digital Artists and 100+ Screenings Create a New AI Arts Showcase';
  }
  if (normalized.includes('中国视觉艺术百年发展史铺陈在苏州河畔')) {
    return 'A Century of Chinese Visual Arts Unfolds Along Suzhou Creek';
  }
  if (normalized.includes('风起海上，青春作答')) {
    return 'A New Wave Meets Youthful Creativity at Shanghai’s Modern Illustration Exhibition';
  }
  return '';
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
