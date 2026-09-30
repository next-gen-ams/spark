import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('insights snapshot keeps three grounded items for each existing refresh lane', async () => {
  const data = JSON.parse(await readFile(new URL('./data/insights.json', import.meta.url), 'utf8'));

  assert.equal(data.version, 1);
  assert.equal(data.pr.items.length, 3);
  assert.deepEqual(data.pr.items.map((item) => item.label), [
    'Trend change',
    'Core topics',
    'Coverage themes',
  ]);
  assert.equal(data.geo.items.length, 3);
  assert.ok(data.pr.sourceGeneratedAt);
  assert.ok(data.geo.sourceCheckedLabel);
  for (const section of [data.pr, data.geo]) {
    for (const item of section.items) {
      assert.ok(item.title.length > 5);
      assert.ok(item.body.length > 20);
      assert.ok(Array.isArray(item.evidence) && item.evidence.length > 0);
    }
  }
});
