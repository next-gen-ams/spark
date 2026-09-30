import {
  AUTH_SESSION_KEY,
  createRememberedAccess,
  hasValidRememberedAccess,
  verifyDashboardPassword,
} from './auth-verifier.js';

const accessGate = document.querySelector('#accessGate');
const appShell = document.querySelector('#appShell');
const loginForm = document.querySelector('#loginForm');
const passwordInput = document.querySelector('#password');
const passwordError = document.querySelector('#passwordError');
const rememberAccess = document.querySelector('#rememberAccess');
const togglePassword = document.querySelector('#togglePassword');
const toast = document.querySelector('#toast');
const appModal = document.querySelector('#appModal');
const mediaSearch = document.querySelector('#mediaSearch');
const waveFilter = document.querySelector('#waveFilter');
const loginButton = loginForm.querySelector('button[type="submit"]');
const lockDashboard = document.querySelector('#lockDashboard');
const countryControl = document.querySelector('#countryControl');
const selectedCountryOption = countryControl.querySelector('[data-market="china"]');
const coverageEvidenceModal = document.querySelector('#coverageEvidenceModal');
const coverageEvidenceImage = document.querySelector('#coverageEvidenceImage');
const coverageEvidenceTitle = document.querySelector('#coverageEvidenceTitle');
const coverageEvidenceDescription = document.querySelector('#coverageEvidenceDescription');
const closeCoverageEvidence = document.querySelector('#closeCoverageEvidence');
const navItems = [...document.querySelectorAll('.nav-item')];
const dashboardViews = [...document.querySelectorAll('[data-view-panel]')];
const validDashboardViews = new Set(['pr-performance', 'geo-visibility']);
let toastTimer;
let hasLoadedLiveData = false;

const COMMON_TITLE_CN = '从“建造”到“创造”：城市与产业变化带来的艺术设计教育新命题';
const COMMON_TITLE_EN = 'From “Building” to “Creating”: New Questions for Art and Design Education Amid Urban and Industrial Change';
const publishedMedia = [
  {
    wave: 'wave-1', outletCn: '环球时报', outletEn: 'Global Times / Huanqiu.com', mark: '环', colour: 'red',
    typeEn: 'National mainstream', typeCn: '全国主流媒体', tier: 'Tier 1 · National',
    introCn: '人民网与环球时报社联合主办，国际新闻与全球议题传播见长。',
    introEn: 'A central-level news outlet focused on international affairs and global issues.',
    titleCn: COMMON_TITLE_CN, titleEn: COMMON_TITLE_EN, date: '2026-09-21',
    url: 'https://huanqiu.com/article/4TIpnA4rPqv',
  },
  {
    wave: 'wave-1', outletCn: '中国日报网', outletEn: 'China Daily', mark: '中', colour: 'blue',
    typeEn: 'National mainstream', typeCn: '国家级综合媒体', tier: 'Tier 1 · National',
    introCn: '国家级综合媒体网站，具备较强的中英文与国际传播能力。',
    introEn: 'A national multimedia outlet with strong bilingual and international distribution.',
    titleCn: COMMON_TITLE_CN, titleEn: COMMON_TITLE_EN, date: '2026-09-21',
    url: 'https://caijing.chinadaily.com.cn/a/202609/21/WS6ab0ebdce4b09a165c78ba42.html',
  },
  {
    wave: 'wave-1', outletCn: '新京报', outletEn: 'The Beijing News', mark: '新', colour: 'violet',
    typeEn: 'Metropolitan mainstream', typeCn: '都市主流媒体', tier: 'Tier 1 · Metro',
    introCn: '立足北京、辐射全国的综合性主流媒体，以调查、评论与城市议题见长。',
    introEn: 'A leading Beijing-based mainstream outlet known for investigations and urban coverage.',
    titleCn: COMMON_TITLE_CN, titleEn: COMMON_TITLE_EN, date: '2026-09-22',
    url: 'https://bjnews.com.cn/detail/1790051755129485.html',
    accessNote: 'May require a China-based IP address',
    capture: './assets/coverage-beijing-news.jpg',
    captureAlt: 'Captured mobile page for The Beijing News article, supplied by the China team.',
  },
  {
    wave: 'wave-1', outletCn: '光明网', outletEn: 'Guangming Online', mark: '光', colour: 'red',
    typeEn: 'National mainstream', typeCn: '中央重点新闻网站', tier: 'Tier 1 · National',
    introCn: '思想理论文化领域的中央重点新闻网站，教育、文化与知识界覆盖突出。',
    introEn: 'A central key news site with particular strength in education, culture and ideas.',
    titleCn: COMMON_TITLE_CN, titleEn: COMMON_TITLE_EN, date: '2026-09-22',
    url: 'https://edu.gmw.cn/2026-09/22/content_39014530.htm',
  },
  {
    wave: 'wave-1', outletCn: '中国青年报', outletEn: 'China Youth Daily', mark: '青', colour: 'blue',
    typeEn: 'National mainstream', typeCn: '中央主流媒体', tier: 'Tier 1 · National',
    introCn: '共青团中央机关报，以青年、教育、社会与人才议题为核心。',
    introEn: 'A central mainstream newspaper focused on youth, education and social issues.',
    titleCn: '城市更新呼唤新设计智慧，设计教育该如何“转身”',
    titleEn: 'Urban Renewal Calls for New Design Thinking: How Should Design Education Transform?',
    date: '2026-09-21', url: 'https://news.youth.cn/hotnews_41880/202609/t20260921_16881184.htm',
  },
  {
    wave: 'wave-1', outletCn: '新浪网', outletEn: 'Sina.com', mark: '新', colour: 'violet',
    typeEn: 'Commercial portal', typeCn: '全国综合门户', tier: 'Tier 2 · Portal',
    introCn: '大型中文综合门户，拥有广泛的新闻频道与大众网络分发能力。',
    introEn: 'A major commercial Chinese portal with broad consumer-news distribution.',
    titleCn: COMMON_TITLE_CN, titleEn: COMMON_TITLE_EN, date: '2026-09-21',
    url: 'https://news.sina.com.cn/sx/2026-09-21/detail-inisqvrw5701176.shtml',
  },
  {
    wave: 'wave-1', outletCn: '北青网', outletEn: 'YNET / Beijing Youth Online', mark: '北', colour: 'red',
    typeEn: 'Regional mainstream', typeCn: '北京区域主流媒体', tier: 'Tier 2 · Regional',
    introCn: '北京青年报官方网站，是北青内容的重要数字分发平台。',
    introEn: 'The official site of Beijing Youth Daily and a key regional distribution platform.',
    titleCn: COMMON_TITLE_CN, titleEn: COMMON_TITLE_EN, date: '2026-09-21',
    url: 'http://culture.ynet.com/2026/09/21/4046030t467.html',
    accessNote: 'May require a China-based IP address',
    capture: './assets/coverage-beijing-youth-online.png',
    captureAlt: 'Captured desktop page for Beijing Youth Online article, supplied by the China team.',
  },
  {
    wave: 'wave-1', outletCn: '北京晚报', outletEn: 'Beijing Evening News', mark: '晚', colour: 'blue',
    typeEn: 'Regional mainstream', typeCn: '北京都市主流媒体', tier: 'Tier 2 · Regional',
    introCn: '北京日报报业集团旗下综合性晚报，强调首都民生与城市文化。',
    introEn: 'A major Beijing evening paper covering city life, culture and public affairs.',
    titleCn: COMMON_TITLE_CN, titleEn: COMMON_TITLE_EN, date: '2026-09-21',
    url: 'https://www.takefoto.cn/news/2026/09/21/11967638.shtml',
  },
  {
    wave: 'wave-1', outletCn: '文汇报', outletEn: 'Wenhui Daily', mark: '文', colour: 'violet',
    typeEn: 'Regional mainstream', typeCn: '上海主流综合日报', tier: 'Tier 1 · Regional',
    introCn: '上海主流综合性日报，在人文、文化、教育与知识界议题中具有影响力。',
    introEn: 'A leading Shanghai daily with influence in culture, education and intellectual affairs.',
    titleCn: COMMON_TITLE_CN, titleEn: COMMON_TITLE_EN, date: '2026-09-21',
    url: 'https://www.jfdaily.com/staticsg/res/html/web/newsDetail.html?id=1181031',
  },
  {
    wave: 'wave-1', outletCn: '南方网', outletEn: 'Southcn.com', mark: '南', colour: 'red',
    typeEn: 'Provincial key portal', typeCn: '省级重点新闻网站', tier: 'Tier 1 · Regional',
    introCn: '广东省委机关网、南方报业旗下省级重点新闻网站，覆盖华南及全国受众。',
    introEn: 'Guangdong’s provincial key news portal within the Southern Media Group.',
    titleCn: COMMON_TITLE_CN, titleEn: COMMON_TITLE_EN, date: '2026-09-21',
    url: 'https://economy.southcn.com/node_71505a4d28/b35b79c1fe.shtml',
  },
];

renderPublishedMedia();

function showDashboard() {
  accessGate.classList.add('is-hidden');
  appShell.classList.remove('is-hidden');
  setDashboardView(dashboardViewFromUrl());
  if (!hasLoadedLiveData) {
    hasLoadedLiveData = true;
    Promise.allSettled([loadMeltwaterData(), loadGeoData()]);
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  passwordError.textContent = '';
  loginButton.disabled = true;
  loginButton.setAttribute('aria-busy', 'true');

  try {
    const isValid = await verifyDashboardPassword(passwordInput.value);
    if (!isValid) {
      passwordError.textContent = 'Incorrect password. Please try again.';
      passwordInput.select();
      return;
    }
    storeAccessPreference();
    showDashboard();
  } catch {
    passwordError.textContent = 'Password verification is unavailable in this browser.';
    passwordInput.focus();
  } finally {
    loginButton.disabled = false;
    loginButton.removeAttribute('aria-busy');
  }
});

passwordInput.addEventListener('input', () => {
  passwordError.textContent = '';
});

togglePassword.addEventListener('click', () => {
  const showing = passwordInput.type === 'text';
  passwordInput.type = showing ? 'password' : 'text';
  togglePassword.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
});

if (hasStoredAccess()) showDashboard();

lockDashboard.addEventListener('click', () => {
  sessionStorage.removeItem(AUTH_SESSION_KEY);
  try {
    localStorage.removeItem(AUTH_SESSION_KEY);
  } catch {
    // The per-tab state has still been cleared when persistent storage is unavailable.
  }
  appShell.classList.add('is-hidden');
  accessGate.classList.remove('is-hidden');
  passwordInput.value = '';
  passwordError.textContent = '';
  document.title = 'RMIT DSC China PR Tracker';
  passwordInput.focus();
});

selectedCountryOption.addEventListener('click', () => {
  countryControl.open = false;
});

document.addEventListener('click', (event) => {
  if (!countryControl.contains(event.target)) countryControl.open = false;
});

countryControl.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    countryControl.open = false;
    countryControl.querySelector('summary').focus();
  }
});

function storeAccessPreference() {
  if (rememberAccess.checked) {
    try {
      localStorage.setItem(AUTH_SESSION_KEY, createRememberedAccess());
      sessionStorage.removeItem(AUTH_SESSION_KEY);
      return;
    } catch {
      // Fall through to per-tab access when persistent storage is unavailable.
    }
  } else {
    try {
      localStorage.removeItem(AUTH_SESSION_KEY);
    } catch {
      // Ignore storage restrictions; per-tab access still works.
    }
  }
  sessionStorage.setItem(AUTH_SESSION_KEY, 'granted');
}

function hasStoredAccess() {
  if (sessionStorage.getItem(AUTH_SESSION_KEY) === 'granted') return true;
  try {
    const remembered = localStorage.getItem(AUTH_SESSION_KEY);
    if (hasValidRememberedAccess(remembered)) return true;
    if (remembered) localStorage.removeItem(AUTH_SESSION_KEY);
  } catch {
    // Persistent storage may be disabled by browser privacy settings.
  }
  return false;
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('is-visible');
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2800);
}

function openInfoModal(kind) {
  const title = document.querySelector('#modalTitle');
  const description = document.querySelector('#modalDescription');
  const eyebrow = document.querySelector('#modalEyebrow');

  if (kind === 'geo') {
    eyebrow.textContent = 'SEPARATE DASHBOARD LINK';
    title.textContent = 'KMT GEO Dashboard URL needed';
    description.textContent = 'This button is ready for the separate KMT GEO Dashboard URL. No placeholder website will be opened in the mockup.';
  } else {
    eyebrow.textContent = 'MELTWATER MCP PLACEHOLDER';
    title.textContent = 'Monitoring connection reserved';
    description.textContent = 'Once the Meltwater MCP is available, this area can ingest monthly mentions, trend points and potential organic pickups. The mockup currently makes no live-data claim.';
  }
  appModal.showModal();
}

document.querySelectorAll('[data-action]').forEach((button) => {
  button.addEventListener('click', () => openInfoModal(button.dataset.action));
});

document.querySelectorAll('[data-demo-link]').forEach((button) => {
  button.addEventListener('click', () => showToast('Sample row only — add the verified publication URL before client use.'));
});

mediaSearch.addEventListener('input', renderPublishedMedia);
waveFilter.addEventListener('change', renderPublishedMedia);

function renderPublishedMedia() {
  const query = mediaSearch?.value.trim().toLowerCase() || '';
  const selectedWave = waveFilter?.value || 'all';
  const filtered = publishedMedia.filter((item) => {
    if (selectedWave !== 'all' && item.wave !== selectedWave) return false;
    const haystack = Object.values(item).join(' ').toLowerCase();
    return !query || haystack.includes(query);
  });

  const body = document.querySelector('#mediaTableBody');
  body.replaceChildren();
  filtered.forEach((item) => {
    const row = document.createElement('tr');
    row.dataset.wave = item.wave;

    const mediaCell = document.createElement('td');
    const media = document.createElement('div');
    media.className = 'media-cell media-cell-profile';
    const logo = document.createElement('span');
    logo.className = `media-logo media-logo-${item.colour}`;
    logo.textContent = item.outletEn.match(/[A-Za-z]/)?.[0]?.toUpperCase() || 'M';
    const mediaCopy = document.createElement('span');
    const outletEn = document.createElement('strong');
    outletEn.textContent = item.outletEn;
    const intro = document.createElement('span');
    intro.className = 'media-intro';
    intro.textContent = item.introEn;
    intro.title = item.introEn;
    mediaCopy.append(outletEn, intro);
    media.append(logo, mediaCopy);
    mediaCell.append(media);

    const landscapeCell = document.createElement('td');
    const tier = document.createElement('span');
    tier.className = 'tier-chip';
    tier.textContent = item.tier;
    const typeEn = document.createElement('strong');
    typeEn.className = 'landscape-type';
    typeEn.textContent = item.typeEn;
    landscapeCell.append(tier, typeEn);

    const articleCell = document.createElement('td');
    const articleLink = document.createElement(item.url ? 'a' : 'span');
    articleLink.className = 'article-link';
    if (item.url) {
      articleLink.href = item.url;
      articleLink.target = '_blank';
      articleLink.rel = 'noopener noreferrer';
    }
    const titleEn = document.createElement('strong');
    titleEn.textContent = item.titleEn;
    const titleCn = document.createElement('small');
    titleCn.className = 'article-title-cn';
    titleCn.textContent = item.titleCn;
    articleLink.append(titleEn, titleCn);
    articleCell.append(articleLink);
    if (item.capture) articleCell.append(createCoverageEvidenceControl(item));

    const dateCell = document.createElement('td');
    const date = document.createElement('strong');
    date.textContent = item.formattedDate || formatLongDate(item.date);
    const wave = document.createElement('small');
    wave.textContent = 'Wave 1 · Beijing Open Day';
    dateCell.append(date, wave);

    const statusCell = document.createElement('td');
    statusCell.innerHTML = '<span class="published-status"><i></i>Published</span>';

    row.append(mediaCell, landscapeCell, articleCell, dateCell, statusCell);
    body.append(row);
  });

  document.querySelector('#waveCount').textContent = `${filtered.length} placement${filtered.length === 1 ? '' : 's'}`;
  document.querySelector('#mediaTableSummary').textContent = `Showing ${filtered.length} confirmed published record${filtered.length === 1 ? '' : 's'} · source updated 29 Sep 2026`;
}

function createCoverageEvidenceControl(item) {
  const row = document.createElement('div');
  row.className = 'coverage-access-row';
  const badge = document.createElement('span');
  badge.className = 'coverage-access-badge';
  badge.textContent = 'China-IP access';
  badge.title = item.accessNote;
  const button = document.createElement('button');
  button.className = 'coverage-capture-button';
  button.type = 'button';
  button.textContent = 'View captured page';
  button.addEventListener('click', () => openCoverageEvidence(item));
  row.append(badge, button);
  return row;
}

function openCoverageEvidence(item) {
  coverageEvidenceTitle.textContent = `${item.outletEn} · Captured page`;
  coverageEvidenceDescription.textContent = `${item.accessNote}. This screenshot was supplied by the China team as a reporting reference.`;
  coverageEvidenceImage.src = item.capture;
  coverageEvidenceImage.alt = item.captureAlt;
  coverageEvidenceModal.showModal();
}

closeCoverageEvidence.addEventListener('click', () => coverageEvidenceModal.close());
coverageEvidenceModal.addEventListener('click', (event) => {
  if (event.target === coverageEvidenceModal) coverageEvidenceModal.close();
});

navItems.forEach((item) => {
  item.addEventListener('click', (event) => {
    event.preventDefault();
    setDashboardView(item.dataset.view, { push: true });
  });
});
window.addEventListener('popstate', () => setDashboardView(dashboardViewFromUrl()));

function dashboardViewFromUrl() {
  const requestedView = new URLSearchParams(window.location.search).get('view');
  return validDashboardViews.has(requestedView) ? requestedView : 'pr-performance';
}

function setDashboardView(requestedView, { push = false } = {}) {
  const view = validDashboardViews.has(requestedView) ? requestedView : 'pr-performance';
  dashboardViews.forEach((panel) => {
    const isActive = panel.dataset.viewPanel === view;
    panel.hidden = !isActive;
    panel.classList.toggle('is-active', isActive);
  });
  navItems.forEach((item) => {
    const isActive = item.dataset.view === view;
    item.classList.toggle('is-active', isActive);
    if (isActive) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
  document.title = view === 'geo-visibility'
    ? 'RMIT DSC GEO Visibility'
    : 'RMIT DSC PR Performance';
  if (push) {
    const url = new URL(window.location.href);
    url.searchParams.set('view', view);
    url.hash = '';
    window.history.pushState({ view }, '', url);
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
}

async function loadMeltwaterData() {
  try {
    const data = await fetchDashboardData();
    renderMeltwaterData(data);
  } catch {
    renderMeltwaterError();
    showToast('Could not load the latest weekly Meltwater snapshot.');
  }
}

async function loadGeoData() {
  try {
    const response = await fetch('./data/geo.json', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('GEO snapshot unavailable');
    const data = await response.json();
    renderGeoData(data);
  } catch {
    renderGeoError();
  }
}

function renderGeoData(data) {
  if (!Array.isArray(data?.personas) || !data.personas.length) throw new Error('Invalid GEO snapshot');
  const preBrand = data.summary?.preBrand;
  if (!preBrand?.validAnswers || !Number.isFinite(preBrand.namesYou)) throw new Error('Invalid GEO pre-brand summary');
  const summary = document.querySelector('#geoSummaryStrip');
  const grid = document.querySelector('#geoPersonaGrid');
  document.querySelector('#geoNameMetricValue').textContent = `${preBrand.namesYou} / ${preBrand.validAnswers}`;
  document.querySelector('#geoNameMetricContext').textContent = `${preBrand.namesYouRate}% across ${preBrand.questions} pre-brand prompts where RMIT was not named.`;
  summary.replaceChildren();
  grid.replaceChildren();

  const summaryItems = [
    `Updated on ${data.meta.checkedLabel}`,
    `${data.summary.audiences} China audiences`,
    `${data.summary.models.length} Chinese leading AI models`,
  ];
  summaryItems.forEach((item, index) => {
    const chip = document.createElement('span');
    chip.className = index === 0 ? 'geo-summary-chip geo-summary-chip-primary' : 'geo-summary-chip';
    chip.textContent = item;
    summary.append(chip);
  });

  data.personas.forEach((persona, personaIndex) => {
    const card = document.createElement('article');
    card.className = 'geo-persona-card';

    const header = document.createElement('header');
    header.className = 'geo-persona-header';
    const identity = document.createElement('div');
    identity.className = 'geo-persona-identity';
    const marker = document.createElement('span');
    marker.className = `geo-persona-marker geo-persona-marker-${personaIndex + 1}`;
    marker.textContent = `Persona ${personaIndex + 1}`;
    const heading = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = persona.name;
    const meta = document.createElement('p');
    meta.textContent = `${persona.country} · ${persona.questions} questions · ${persona.answers} answers`;
    heading.append(title, meta);
    identity.append(marker, heading);

    const score = document.createElement('div');
    score.className = 'geo-persona-score';
    const scoreValue = document.createElement('strong');
    scoreValue.textContent = `${persona.namedRate}%`;
    const scoreLabel = document.createElement('span');
    scoreLabel.textContent = `${persona.named}/${persona.answers} answers name RMIT`;
    score.append(scoreValue, scoreLabel);
    header.append(identity, score);

    const progress = document.createElement('div');
    progress.className = 'geo-persona-progress';
    const progressBar = document.createElement('span');
    progressBar.style.width = `${Math.max(0, Math.min(100, persona.namedRate))}%`;
    progress.append(progressBar);

    const journeys = document.createElement('div');
    journeys.className = 'geo-journey-list';
    persona.journeys.forEach((journey) => journeys.append(createGeoJourney(journey)));
    card.append(header, progress, journeys);
    grid.append(card);
  });
}

function createGeoJourney(journey) {
  const labels = {
    awareness: 'Awareness',
    consideration: 'Consideration',
    conversion: 'Conversion',
  };
  const stageLabel = labels[journey.stage] || journey.stage;
  const details = document.createElement('details');
  details.className = `geo-journey geo-journey-${journey.stage}`;
  const summary = document.createElement('summary');

  const stage = document.createElement('span');
  stage.className = 'geo-stage-label';
  const stageName = document.createElement('strong');
  stageName.textContent = stageLabel;
  const sampleLabel = document.createElement('small');
  sampleLabel.textContent = 'Sample prompt';
  stage.append(stageName, sampleLabel);

  const prompt = document.createElement('span');
  prompt.className = 'geo-prompt';
  const promptEn = document.createElement('strong');
  promptEn.lang = 'en';
  promptEn.textContent = journey.promptEn;
  const promptCn = document.createElement('small');
  promptCn.lang = 'zh-CN';
  promptCn.textContent = journey.prompt;
  prompt.append(promptEn, promptCn);

  const result = document.createElement('span');
  result.className = 'geo-stage-result';
  const ratio = document.createElement('strong');
  ratio.textContent = `${journey.named}/${journey.answerCount}`;
  const resultLabel = document.createElement('small');
  resultLabel.textContent = 'answers name RMIT';
  result.append(ratio, resultLabel);

  const chevron = document.createElement('span');
  chevron.className = 'geo-chevron';
  chevron.setAttribute('aria-hidden', 'true');
  chevron.textContent = '⌄';
  summary.append(stage, prompt, result, chevron);

  const body = document.createElement('div');
  body.className = 'geo-journey-body';
  const answerIntro = document.createElement('p');
  answerIntro.className = 'geo-answer-intro';
  answerIntro.textContent = 'Expand a model to review its answer and cited sources.';
  const answerGrid = document.createElement('div');
  answerGrid.className = 'geo-answer-grid';
  journey.answers.forEach((answer) => answerGrid.append(createModelAnswer(answer)));
  body.append(answerIntro, answerGrid);
  details.append(summary, body);
  return details;
}

function createModelAnswer(answer) {
  const details = document.createElement('details');
  details.className = `geo-model-answer geo-model-${answer.modelId}`;
  const summary = document.createElement('summary');
  const identity = document.createElement('span');
  identity.className = 'geo-model-identity';
  const mark = document.createElement('span');
  mark.textContent = answer.model.slice(0, 1);
  const name = document.createElement('strong');
  name.textContent = answer.model;
  identity.append(mark, name);
  const toggle = document.createElement('span');
  toggle.className = 'geo-model-toggle';
  toggle.textContent = 'View answer';
  summary.append(identity, toggle);

  const content = document.createElement('div');
  content.className = 'geo-model-content';
  const translationLabel = document.createElement('span');
  translationLabel.className = 'geo-translation-label';
  translationLabel.textContent = answer.answerTextEn
    ? 'English translation · Translated from the original Chinese response'
    : 'Original Chinese response · English translation pending';
  const answerText = document.createElement('p');
  answerText.className = 'geo-answer-copy';
  answerText.lang = answer.answerTextEn ? 'en' : 'zh-CN';
  answerText.textContent = formatGeoAnswer(answer.answerTextEn || answer.answerText);
  content.append(translationLabel, answerText);

  if (answer.sources.length) {
    const sources = document.createElement('div');
    sources.className = 'geo-answer-sources';
    const sourceLabel = document.createElement('strong');
    sourceLabel.textContent = 'Sources returned by model';
    const sourceList = document.createElement('div');
    answer.sources.forEach((source, index) => {
      const link = document.createElement('a');
      link.href = source;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = `${index + 1}. ${displayHostname(source)}`;
      sourceList.append(link);
    });
    sources.append(sourceLabel, sourceList);
    content.append(sources);
  }

  details.append(summary, content);
  return details;
}

function renderGeoError() {
  const summary = document.querySelector('#geoSummaryStrip');
  const grid = document.querySelector('#geoPersonaGrid');
  document.querySelector('#geoNameMetricValue').textContent = '—';
  document.querySelector('#geoNameMetricContext').textContent = 'Monthly GEO snapshot unavailable.';
  summary.replaceChildren();
  grid.replaceChildren();
  const status = document.createElement('span');
  status.className = 'geo-summary-chip';
  status.textContent = 'GEO snapshot unavailable';
  const empty = document.createElement('article');
  empty.className = 'geo-persona-loading';
  empty.textContent = 'The next scheduled GEO snapshot will retry automatically.';
  summary.append(status);
  grid.append(empty);
}

function displayHostname(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return 'Source';
  }
}

function formatGeoAnswer(value) {
  return String(value || '')
    .replace(/\\n/g, '\n')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*/g, '')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .trim();
}

async function fetchDashboardData() {
  const snapshotResponse = await fetch('./data/meltwater.json', {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!snapshotResponse.ok) throw new Error('Weekly snapshot unavailable');
  return snapshotResponse.json();
}

function renderMeltwaterData(data) {
  const { meta, summary, trend, topics, mentions, peaks = [] } = data;
  const connectionStatus = document.querySelector('#connectionStatus');
  connectionStatus.lastChild.textContent = 'Meltwater · Weekly snapshot';
  connectionStatus.classList.add('is-live');

  document.querySelector('#totalMentionsMetric').textContent = formatNumber(summary.totalMentions);
  document.querySelector('#totalMentionsMetric').classList.remove('metric-pending');
  document.querySelector('#totalMentionsDescription').textContent = `${formatNumber(summary.averagePerDay)} mentions per day on average.`;
  document.querySelector('#meltwaterMetricStatus').textContent = 'MELTWATER API';
  document.querySelector('#reachMetric').textContent = formatCompact(summary.potentialReach);
  document.querySelector('#reachDescription').textContent = `${formatCompact(summary.estimatedViews)} estimated views · source audiences may overlap.`;

  const generatedAt = new Date(meta.generatedAt);
  document.querySelector('#lastRefreshed').textContent = formatDateTime(generatedAt);
  document.querySelector('#nextRefresh').textContent = formatDateTime(new Date(meta.nextRefreshAt));
  document.querySelector('#headerLastUpdated').textContent = `Updated ${formatDateTime(generatedAt)}`;
  document.querySelector('#dataSourceFooter').textContent = `${meta.searchName} · Meltwater weekly snapshot · Updated ${formatDateTime(generatedAt)}`;

  renderTrend(trend, peaks);
  renderSentiment(summary);
  renderTopics(topics);
  renderMentions(mentions);
}

function renderTrend(trend, peaks = []) {
  const loading = document.querySelector('#chartLoading');
  if (!trend.length) {
    loading.hidden = false;
    loading.querySelector('strong').textContent = 'No mentions in this period';
    loading.querySelector('p').textContent = 'The Saved Search returned no daily trend points.';
    return;
  }

  loading.hidden = true;
  const width = 720;
  const top = 20;
  const bottom = 210;
  const max = Math.max(...trend.map((point) => point.count), 1);
  const coordinates = trend.map((point, index) => {
    const x = trend.length === 1 ? width / 2 : (index / (trend.length - 1)) * width;
    const y = bottom - (point.count / max) * (bottom - top);
    return [x, y];
  });
  const linePath = coordinates.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  document.querySelector('#chartLine').setAttribute('d', linePath);
  document.querySelector('#chartArea').setAttribute('d', `${linePath} L${width} ${bottom} L0 ${bottom} Z`);
  document.querySelector('#chartHigh').textContent = String(max);
  document.querySelector('#chartMid').textContent = String(Math.ceil(max / 2));

  const labelIndexes = [0, .25, .5, .75, 1].map((ratio) => Math.round((trend.length - 1) * ratio));
  const labels = document.querySelectorAll('#chartXAxis span');
  labels.forEach((label, index) => {
    label.textContent = formatShortDate(trend[labelIndexes[index]].date);
  });

  renderPeakPoints(trend, peaks, coordinates);
}

function renderPeakPoints(trend, peaks, coordinates) {
  const container = document.querySelector('#chartPoints');
  const tooltip = document.querySelector('#trendTooltip');
  container.replaceChildren();
  tooltip.hidden = true;
  const indexByDate = new Map(trend.map((point, index) => [point.date, index]));

  peaks.forEach((peak) => {
    const index = indexByDate.get(peak.date);
    if (index === undefined) return;
    const [x, y] = coordinates[index];
    const point = document.createElement('button');
    point.type = 'button';
    point.className = 'chart-peak-point';
    point.style.left = `${(x / 720) * 100}%`;
    point.style.top = `${(y / 230) * 100}%`;
    point.setAttribute('aria-label', `${formatLongDate(peak.date)}: ${peak.count} mentions. Show key mentions.`);
    point.addEventListener('mouseenter', () => showPeakTooltip(peak, point));
    point.addEventListener('focus', () => showPeakTooltip(peak, point, true));
    point.addEventListener('click', () => showPeakTooltip(peak, point, true));
    container.append(point);
  });

  const frame = document.querySelector('#trendChartFrame');
  frame.onmouseleave = () => {
    if (tooltip.dataset.pinned !== 'true') tooltip.hidden = true;
  };
}

function showPeakTooltip(peak, point, pinned = false) {
  const tooltip = document.querySelector('#trendTooltip');
  tooltip.dataset.pinned = String(pinned);
  tooltip.replaceChildren();
  const heading = document.createElement('div');
  heading.className = 'trend-tooltip-heading';
  const label = document.createElement('span');
  label.textContent = `${formatLongDate(peak.date)} · ${peak.count} mentions`;
  const hint = document.createElement('small');
  hint.textContent = 'Top mentions by Meltwater reach';
  heading.append(label, hint);
  tooltip.append(heading);

  const mentions = Array.isArray(peak.mentions) ? peak.mentions.slice(0, 3) : [];
  mentions.forEach((mention) => {
    const link = document.createElement('a');
    link.href = mention.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    const title = document.createElement('strong');
    title.textContent = mention.titleEn || 'English title pending review';
    const titleCn = document.createElement('span');
    titleCn.className = 'trend-title-cn';
    titleCn.textContent = mention.title;
    const meta = document.createElement('small');
    meta.textContent = `${mention.source} · Reach ${formatCompact(mention.reach)}`;
    link.append(title, titleCn, meta);
    tooltip.append(link);
  });

  if (!mentions.length) {
    const empty = document.createElement('p');
    empty.className = 'trend-tooltip-empty';
    empty.textContent = 'Article-level results were not returned in this weekly Meltwater snapshot.';
    tooltip.append(empty);
  }

  const pointLeft = Number.parseFloat(point.style.left);
  tooltip.classList.toggle('tip-align-left', pointLeft > 50);
  tooltip.style.removeProperty('left');
  tooltip.style.removeProperty('top');
  tooltip.hidden = false;
}

function renderSentiment(summary) {
  const positive = Math.max(0, Math.min(100, summary.positivePercent));
  const neutral = Math.max(0, Math.min(100 - positive, summary.neutralPercent));
  const neutralEnd = positive + neutral;
  const ring = document.querySelector('#sentimentRing');
  ring.style.background = `conic-gradient(#38a581 0 ${positive}%, #dfe5e7 ${positive}% ${neutralEnd}%, #e61e2a ${neutralEnd}% 100%)`;
  document.querySelector('#sentimentRingValue').textContent = formatPercent(summary.neutralPercent);
  document.querySelector('#sentimentHeadline').textContent = 'Neutral-led conversation';
  document.querySelector('#sentimentBreakdown').textContent = `Positive ${formatPercent(summary.positivePercent)} · Neutral ${formatPercent(summary.neutralPercent)} · Negative ${formatPercent(summary.negativePercent)}`;
}

function renderTopics(topics) {
  const container = document.querySelector('#topicList');
  container.replaceChildren();
  if (!topics.length) {
    const empty = document.createElement('div');
    empty.className = 'topic-loading';
    empty.textContent = 'No topic data returned for this period.';
    container.append(empty);
    return;
  }

  const max = Math.max(...topics.map((topic) => topic.count), 1);
  topics.forEach((topic) => {
    const row = document.createElement('div');
    row.className = 'topic-row';
    const header = document.createElement('div');
    const name = document.createElement('span');
    const count = document.createElement('strong');
    name.textContent = topic.name;
    count.textContent = formatNumber(topic.count);
    header.append(name, count);
    const track = document.createElement('div');
    track.className = 'topic-track';
    const bar = document.createElement('span');
    bar.style.width = `${Math.max(5, (topic.count / max) * 100)}%`;
    track.append(bar);
    row.append(header, track);
    container.append(row);
  });
}

function renderMentions(mentions) {
  const container = document.querySelector('#mentionsGrid');
  container.replaceChildren();
  if (!mentions.length) {
    const empty = document.createElement('article');
    empty.className = 'pickup-record pickup-record-empty';
    empty.textContent = 'No recent Meltwater mentions were returned.';
    container.append(empty);
    return;
  }

  mentions.slice(0, 6).forEach((mention, index) => {
    const article = document.createElement('article');
    article.className = 'pickup-record mention-record';

    const logo = document.createElement('span');
    logo.className = `media-logo ${['media-logo-red', 'media-logo-blue', 'media-logo-violet'][index % 3]}`;
    logo.textContent = sourceMark(mention.source);

    const copy = document.createElement('div');
    const label = document.createElement('span');
    label.className = `record-label sentiment-${mention.sentiment}`;
    label.textContent = `${mention.sentiment.toUpperCase()} · ${formatShortDate(mention.publishedDate)}`;
    const title = document.createElement('strong');
    title.textContent = mention.titleEn || 'English title pending review';
    title.title = title.textContent;
    const titleCn = document.createElement('span');
    titleCn.className = 'mention-title-cn';
    titleCn.textContent = mention.title;
    const source = document.createElement('small');
    source.textContent = `${mention.source} · Potential reach ${formatCompact(mention.reach)}`;
    copy.append(label, title, titleCn, source);

    const link = document.createElement('a');
    link.className = 'link-button';
    link.href = mention.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Review ↗';
    article.append(logo, copy, link);
    container.append(article);
  });
}

function renderMeltwaterError() {
  const connectionStatus = document.querySelector('#connectionStatus');
  connectionStatus.lastChild.textContent = 'Meltwater unavailable';
  connectionStatus.classList.remove('is-live');
  document.querySelector('#meltwaterMetricStatus').textContent = 'RETRY NEEDED';
  const loading = document.querySelector('#chartLoading');
  loading.hidden = false;
  loading.querySelector('strong').textContent = 'Live trend unavailable';
  loading.querySelector('p').textContent = 'The next scheduled weekly refresh will retry automatically.';
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-AU').format(Number(value) || 0);
}

function sourceMark(source) {
  return String(source || '').match(/[A-Za-z]/)?.[0]?.toUpperCase() || 'M';
}

function formatCompact(value) {
  return new Intl.NumberFormat('en-AU', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(value) || 0);
}

function formatPercent(value) {
  return `${new Intl.NumberFormat('en-AU', { maximumFractionDigits: 1 }).format(Number(value) || 0)}%`;
}

function formatShortDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short' }).format(date);
}

function formatLongDate(value) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function formatDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Pending';
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}
