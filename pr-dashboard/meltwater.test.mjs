import test from 'node:test';
import assert from 'node:assert/strict';
import { getThreeMonthRange, normalizeDashboard } from './scripts/meltwater.mjs';

test('builds a rolling three-calendar-month range', () => {
  const range = getThreeMonthRange(new Date('2026-09-28T23:30:00.000Z'));
  assert.equal(range.start, '2026-06-28T23:30:00');
  assert.equal(range.end, '2026-09-28T23:30:00');
});

test('normalizes analytics, topics and safe mention links', () => {
  const dashboard = normalizeDashboard({
    search: { id: 29175637, name: 'RMIT China DSC ' },
    analytics: {
      volume: { document_count: 234, per_day: 2 },
      sentiment: { neutral: { document_count: 220, percentage: 94 } },
      time_series: [{ date: '2026-09-28', document_count: 8 }],
    },
    topics: [{
      topic: 'jobs_and_education',
      sub_topics: [{ topic: 'study_abroad', display_name: 'Study Abroad', document_count: 70, percentage: 29.9 }],
    }],
    documents: [{
      id: 'abc',
      content: { title: '  Sample   mention ' },
      source: { name: 'Example outlet' },
      url: 'javascript:alert(1)',
      enrichments: { sentiment: 'positive' },
    }, {
      id: 'def',
      content: { title: 'Valid mention' },
      source: { name: 'Example outlet', metrics: { reach: 120000 } },
      url: 'https://example.com/story',
      enrichments: { sentiment: 'positive' },
    }],
    reachAnalytics: {
      result: {
        analysis: {
          reach: { sum: 2684998018 },
          estimated_views: { sum: 39044 },
        },
      },
    },
    peakResults: [{
      date: '2026-09-28',
      count: 8,
      documents: [{
        id: 'peak',
        content: { title: '下一代设计，正在北京发生' },
        source: { name: 'Peak outlet', metrics: { reach: 167775 } },
        url: 'https://example.com/peak',
        enrichments: { sentiment: 'neutral' },
      }],
    }],
    range: {
      startIso: '2026-06-28T23:30:00.000Z',
      endIso: '2026-09-28T23:30:00.000Z',
    },
    generatedAt: '2026-09-28T23:30:00.000Z',
  });

  assert.equal(dashboard.meta.searchName, 'RMIT China DSC');
  assert.equal(dashboard.summary.totalMentions, 234);
  assert.equal(dashboard.summary.potentialReach, 2684998018);
  assert.equal(dashboard.summary.estimatedViews, 39044);
  assert.deepEqual(dashboard.trend, [{ date: '2026-09-28', count: 8 }]);
  assert.deepEqual(dashboard.topics, [{ name: 'Study abroad', count: 70, percentage: 29.9 }]);
  assert.equal(dashboard.mentions.length, 1);
  assert.equal(dashboard.mentions[0].url, 'https://example.com/story');
  assert.equal(dashboard.mentions[0].reach, 120000);
  assert.equal(dashboard.peaks[0].mentions[0].titleEn, 'The Next Generation of Design Is Taking Shape in Beijing');
});
