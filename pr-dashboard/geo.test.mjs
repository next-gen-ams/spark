import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const geoPath = new URL('./data/geo.json', import.meta.url);

test('GEO snapshot contains three personas and one sample prompt per journey', async () => {
  const data = JSON.parse(await readFile(geoPath, 'utf8'));

  assert.equal(data.meta.readOnly, true);
  assert.equal(data.summary.audiences, 3);
  assert.equal(data.summary.samplePrompts, 9);
  assert.deepEqual(data.summary.models, ['Doubao', 'ERNIE', 'Qwen']);
  assert.deepEqual(data.summary.preBrand, {
    questions: 30,
    engines: 3,
    validAnswers: 87,
    namesYou: 59,
    namesCompetitor: 3,
    noVendor: 25,
    namedByAnyEngine: 22,
    namedByAnyEngineTotal: 30,
    namesYouRate: 68,
  });
  assert.equal(
    data.summary.preBrand.namesYou + data.summary.preBrand.namesCompetitor + data.summary.preBrand.noVendor,
    data.summary.preBrand.validAnswers,
  );
  assert.equal(data.personas.length, 3);

  for (const persona of data.personas) {
    assert.equal(persona.journeys.length, 3);
    assert.deepEqual(persona.journeys.map((journey) => journey.stage), [
      'awareness',
      'consideration',
      'conversion',
    ]);
    for (const journey of persona.journeys) {
      assert.ok(journey.prompt.length > 10);
      assert.ok(journey.promptEn.length > 20);
      assert.equal(journey.answers.length, 3);
      assert.ok(journey.named >= 0 && journey.named <= journey.answerCount);
      for (const answer of journey.answers) {
        assert.ok(['Doubao', 'ERNIE', 'Qwen'].includes(answer.model));
        assert.ok(answer.answerText.length > 100);
        assert.ok(answer.answerTextEn.length > 100);
        assert.doesNotMatch(answer.answerTextEn, /[\u3400-\u9fff]/);
        for (const source of answer.sources) {
          assert.ok(/^https?:\/\//.test(source));
        }
      }
    }
  }
});

test('GEO browser snapshot contains no API or OAuth credentials', async () => {
  const json = await readFile(geoPath, 'utf8');

  assert.doesNotMatch(json, /access[_-]?token|refresh[_-]?token|client[_-]?secret|bearer\s+|x-api-key|api[_-]?key/i);
});
