import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { archivePreviousSnapshot } from './snapshot-utils.mjs';

const GEO_ORIGIN = 'https://geo.kmt.global';
const SHARE_TOKEN = 'XYK19lgzKLyGdYjkoELc5o8aA1pO0RIUPQD45KRMn0g';
const SHARE_URL = `${GEO_ORIGIN}/share/${SHARE_TOKEN}`;
const ANSWER_FUNCTION_ID = 'fddc5f269fa1c14ee74b152f6a09801ec884cdf7c6021c83f16ea7a94650e3a8';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(root, 'data', 'geo.json');
const previousPath = path.join(root, 'data', 'history', 'geo-previous.json');

const PERSONAS = [
  {
    id: 'scope_2deff7751a16e9d4',
    name: 'Prospective Chinese undergraduates in creative and built environment fields',
    shortName: 'Prospective undergraduates',
    samples: {
      awareness: '中国高中生想去澳大利亚读艺术、设计或创意类本科，哪些大学更重视实践和行业连接？',
      consideration: 'RMIT、UTS、UNSW、墨尔本大学和悉尼大学的艺术设计本科有什么区别？请从教学方式、作品集、行业连接和毕业发展比较。',
      conversion: '对中国学生来说，RMIT设计与社会学院的本科是否值得申请？最适合哪些学习和职业目标？',
    },
    samplesEn: {
      awareness: 'Which Australian universities place the strongest emphasis on practical learning and industry connections for Chinese high school students seeking an undergraduate degree in art, design or a creative discipline?',
      consideration: 'How do the undergraduate art and design programs at RMIT, UTS, UNSW, the University of Melbourne and the University of Sydney differ in teaching approach, portfolio expectations, industry connections and graduate outcomes?',
      conversion: "Is an undergraduate degree in RMIT's College of Design and Social Context worth applying for as a Chinese student, and which study and career goals is it best suited to?",
    },
  },
  {
    id: 'scope_088a1d174ce2771e',
    name: 'Chinese parents of prospective undergraduate students',
    shortName: 'Parents of undergraduates',
    samples: {
      awareness: '中国家庭如何判断去澳大利亚读艺术设计本科的投入是否值得？应该看哪些就业和学习证据？',
      consideration: 'RMIT不是澳大利亚八大，这会不会影响中国学生回国求职？和八大相比应该如何判断它的专业价值？',
      conversion: '家长在决定让孩子申请RMIT前，最应该向学校确认哪些课程、作品集、就业和学生支持信息？',
    },
    samplesEn: {
      awareness: 'How can Chinese families assess whether the investment in an Australian undergraduate art and design degree is worthwhile? What evidence about learning and employment outcomes should they examine?',
      consideration: "RMIT is not a Group of Eight university. Will this affect a Chinese graduate's employment prospects after returning to China, and how should families assess its professional value against Group of Eight universities?",
      conversion: 'Before their child applies to RMIT, what should parents ask the university about courses, portfolios, employment outcomes and student support?',
    },
  },
  {
    id: 'scope_e03edc2fb28bfe70',
    name: 'Chinese postgraduate candidates and early career professionals',
    shortName: 'Postgraduates & early-career professionals',
    samples: {
      awareness: '想转入创意或建成环境行业，什么样的硕士课程最能提供作品集、真实项目和行业经验？',
      consideration: 'RMIT、UTS、UNSW、墨尔本大学和悉尼大学的实践型设计或建成环境硕士有什么区别？',
      conversion: '根据我的本科和工作背景，RMIT设计与社会学院的哪些研究生课程最适合我的职业目标？',
    },
    samplesEn: {
      awareness: "For someone seeking to transition into the creative or built-environment sector, what kind of master's program best provides a strong portfolio, real projects and industry experience?",
      consideration: "How do practice-led master's programs in design or the built environment at RMIT, UTS, UNSW, the University of Melbourne and the University of Sydney differ?",
      conversion: "Based on my undergraduate degree and work experience, which postgraduate programs within RMIT's College of Design and Social Context best fit my career goals?",
    },
  },
];

const STAGES = ['awareness', 'consideration', 'conversion'];
const translationCache = await loadTranslationCache();

const overviewHtml = await getText(`${SHARE_URL}/geo-report`);
const checkedLabel = extractCheckedLabel(overviewHtml);
const ordinal = extractOrdinal(overviewHtml);
const overall = extractOverallSummary(overviewHtml);
const personas = [];

for (const persona of PERSONAS) {
  const analysisUrl = `${SHARE_URL}/geo-report?section=analysis&view=audience&persona=${encodeURIComponent(persona.id)}`;
  const html = await getText(analysisUrl);
  const metrics = extractPersonaMetrics(html, persona.name);
  const questionIds = extractQuestionIds(html);
  const journeys = [];

  for (const stage of STAGES) {
    const prompt = persona.samples[stage];
    const stageMetrics = metrics.stages[stage];
    const questionId = questionIds.get(prompt);
    if (!questionId) throw new Error(`Question ID not found for ${persona.shortName} / ${stage}`);
    const detail = await fetchQuestionAnswers(questionId);
    if (detail.text !== prompt) throw new Error(`Question text mismatch for ${questionId}`);
    journeys.push({
      stage,
      named: stageMetrics.named,
      answerCount: stageMetrics.answers,
      prompt,
      promptEn: persona.samplesEn[stage],
      questionId,
      answers: detail.answers.map((answer) => normaliseAnswer(answer, questionId)),
    });
  }

  personas.push({
    id: persona.id,
    name: persona.name,
    shortName: persona.shortName,
    country: 'China',
    questions: metrics.questions,
    named: metrics.named,
    answers: metrics.answers,
    namedRate: metrics.namedRate,
    journeys,
  });
}

const output = {
  meta: {
    project: 'RMIT DSC China PR GEO',
    source: 'KMT GEO shared report',
    reportUrl: SHARE_URL,
    checkedLabel,
    ordinal,
    fetchedAt: new Date().toISOString(),
    readOnly: true,
  },
  summary: {
    audiences: personas.length,
    models: ['Doubao', 'ERNIE', 'Qwen'],
    samplePrompts: personas.length * STAGES.length,
    ...overall,
  },
  personas,
};

await mkdir(path.dirname(outputPath), { recursive: true });
await archivePreviousSnapshot({ currentPath: outputPath, previousPath, nextSnapshot: output });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, { mode: 0o600 });
console.log(`Wrote ${outputPath}`);
console.log(`${personas.length} personas · ${output.summary.samplePrompts} prompts · ${checkedLabel}`);

async function getText(url) {
  const parsed = new URL(url);
  if (parsed.origin !== GEO_ORIGIN) throw new Error('Unexpected GEO origin');
  const response = await fetch(parsed, {
    headers: { Accept: 'text/html,application/json' },
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`KMT GEO returned ${response.status}`);
  return response.text();
}

function extractCheckedLabel(html) {
  return html.match(/Checked\s*<b>([^<]+)<\/b>/)?.[1]?.trim() || 'Latest check';
}

function extractOrdinal(html) {
  return stripTags(html.match(/<span class="pz-rail-ord">([\s\S]*?)<\/span>/)?.[1] || '') || 'Latest check';
}

function extractOverallSummary(html) {
  const answers = Number(html.match(/By audience<\/h2>[\s\S]*?>(\d+) answers, all three stages/)?.[1] || 0);
  const noVendor = Number(html.match(/title="(\d+) answers name no vendor"/)?.[1] || 0);
  const preBrandMatch = html.match(
    /aria-label="Of the (\d+) answers (\d+) engines gave to (\d+) questions where you were not named first, (\d+) name you, (\d+) name a competitor instead, and (\d+) name no vendor at all\."/,
  );
  if (!preBrandMatch) throw new Error('Pre-brand GEO summary not found');
  const validAnswers = Number(preBrandMatch[1]);
  const engines = Number(preBrandMatch[2]);
  const questions = Number(preBrandMatch[3]);
  const namesYou = Number(preBrandMatch[4]);
  const namesCompetitor = Number(preBrandMatch[5]);
  const preBrandNoVendor = Number(preBrandMatch[6]);
  const beforeTheyNameYou = html.slice(html.indexOf('Before they name you'), html.indexOf('By audience</h2>'));
  const namedByAnyMatch = beforeTheyNameYou.match(/Named by at least one engine[\s\S]*?font-semibold text-foreground">(\d+)[\s\S]*?\/(?:<[^>]+>)*\s*(\d+)/);
  if (!namedByAnyMatch) throw new Error('Pre-brand named-by-engine summary not found');
  return {
    answers,
    noVendor,
    preBrand: {
      questions,
      engines,
      validAnswers,
      namesYou,
      namesCompetitor,
      noVendor: preBrandNoVendor,
      namedByAnyEngine: Number(namedByAnyMatch[1]),
      namedByAnyEngineTotal: Number(namedByAnyMatch[2]),
      namesYouRate: Math.round((namesYou / validAnswers) * 100),
    },
  };
}

function extractPersonaMetrics(html, name) {
  const buttons = html.match(/<button type="button" role="radio"[\s\S]*?<\/button>/g) || [];
  const block = buttons.find((candidate) => stripTags(candidate).includes(name));
  if (!block) throw new Error(`Persona metrics not found for ${name}`);
  const plain = stripTags(block);
  const score = plain.match(/(\d+)%\s*(\d+)\s*\/\s*(\d+)\s*answers named/);
  const questionCount = Number(plain.match(/China\s*·\s*(\d+)\s*questions/)?.[1] || 0);
  const stageText = block.match(/aria-label="Awareness (\d+) of (\d+), Consideration (\d+) of (\d+), Conversion (\d+) of (\d+)"/);
  if (!score || !stageText) throw new Error(`Incomplete persona metrics for ${name}`);
  return {
    namedRate: Number(score[1]),
    named: Number(score[2]),
    answers: Number(score[3]),
    questions: questionCount,
    stages: {
      awareness: { named: Number(stageText[1]), answers: Number(stageText[2]) },
      consideration: { named: Number(stageText[3]), answers: Number(stageText[4]) },
      conversion: { named: Number(stageText[5]), answers: Number(stageText[6]) },
    },
  };
}

function extractQuestionIds(html) {
  const questions = new Map();
  const pattern = /questionId:"([^"]+)",text:"((?:\\.|[^"])*)"/g;
  for (const match of html.matchAll(pattern)) {
    const text = JSON.parse(`"${match[2].replace(/\u2028|\u2029/g, '')}"`);
    questions.set(text, match[1]);
  }
  return questions;
}

async function fetchQuestionAnswers(questionId) {
  const payload = serialiseServerInput({ token: SHARE_TOKEN, questionId });
  const url = new URL(`/_serverFn/${ANSWER_FUNCTION_ID}`, GEO_ORIGIN);
  url.searchParams.set('payload', JSON.stringify(payload));
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'x-tsr-serverFn': 'true',
    },
  });
  if (!response.ok) throw new Error(`KMT GEO answer feed returned ${response.status}`);
  const decoded = decodeSeroval(await response.json());
  if (decoded?.error) throw new Error(`KMT GEO answer feed failed for ${questionId}`);
  return decoded.result;
}

function serialiseServerInput(data) {
  const stringNode = (value) => ({ t: 1, s: value });
  return {
    t: {
      t: 10,
      i: 0,
      p: {
        k: ['data'],
        v: [{
          t: 10,
          i: 1,
          p: {
            k: ['token', 'questionId'],
            v: [stringNode(data.token), stringNode(data.questionId)],
          },
          o: 0,
        }],
      },
      o: 0,
    },
    f: 63,
    m: [],
  };
}

function decodeSeroval(node, refs = new Map()) {
  if (!node || typeof node !== 'object') return node;
  if (node.t === 4) return refs.get(node.i);
  if (node.t === 0) return Number(node.s);
  if (node.t === 1) return String(node.s ?? '');
  if (node.t === 2) return [null, undefined, true, false, -0, Infinity, -Infinity, NaN][node.s];
  if (node.t === 9) {
    const array = [];
    refs.set(node.i, array);
    for (const item of node.a || []) array.push(decodeSeroval(item, refs));
    return array;
  }
  if (node.t === 10 || node.t === 11) {
    const object = node.t === 11 ? Object.create(null) : {};
    refs.set(node.i, object);
    const keys = node.p?.k || [];
    const values = node.p?.v || [];
    keys.forEach((key, index) => {
      if (!['__proto__', 'constructor', 'prototype'].includes(key)) {
        object[key] = decodeSeroval(values[index], refs);
      }
    });
    return object;
  }
  throw new Error(`Unsupported GEO response node type: ${node.t}`);
}

function normaliseAnswer(answer, questionId) {
  const answerText = String(answer.answerText || '').trim();
  if (!answerText) throw new Error(`Empty answer returned for ${answer.modelId}`);
  const answerTextEn = translationCache.get(translationKey(questionId, answer.modelId, answerText));
  return {
    model: modelName(answer.modelId),
    modelId: answer.modelId,
    mentioned: Boolean(answer.mentioned),
    position: Number.isFinite(answer.position) ? answer.position : null,
    grounded: Boolean(answer.grounded),
    answerText,
    ...(answerTextEn ? { answerTextEn } : {}),
    sources: (answer.sources || []).map(safeUrl).filter(Boolean).slice(0, 8),
  };
}

async function loadTranslationCache() {
  try {
    const existing = JSON.parse(await readFile(outputPath, 'utf8'));
    const cache = new Map();
    for (const persona of existing.personas || []) {
      for (const journey of persona.journeys || []) {
        for (const answer of journey.answers || []) {
          if (answer.answerTextEn) {
            cache.set(
              translationKey(journey.questionId, answer.modelId, answer.answerText),
              answer.answerTextEn,
            );
          }
        }
      }
    }
    return cache;
  } catch {
    return new Map();
  }
}

function translationKey(questionId, modelId, answerText) {
  return `${questionId}\u0000${modelId}\u0000${answerText}`;
}

function modelName(value) {
  return ({ doubao: 'Doubao', ernie: 'ERNIE', qwen: 'Qwen' })[value] || value;
}

function safeUrl(value) {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

function stripTags(value) {
  return String(value)
    .replace(/<!-- -->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
