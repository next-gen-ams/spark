import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import {
  completionRequest,
  isFollowUpOpen,
} from '../supabase/functions/_shared/emt-completion.ts';

void test('completion accepts only a positive integer ID and explicit boolean', () => {
  assert.deepEqual(completionRequest(1, true), { id: 1, complete: true });
  assert.deepEqual(completionRequest(1, false), { id: 1, complete: false });
  for (const id of [0, -1, 1.2, '1', null, undefined])
    assert.throws(() => completionRequest(id, true));
  for (const complete of ['false', 0, null, undefined])
    assert.throws(() => completionRequest(1, complete));
});

void test('completed tasks stop reminders; legacy and reopened tasks remain eligible', () => {
  assert.equal(isFollowUpOpen({ completed_at: '2026-10-19T00:00:00Z' }), false);
  assert.equal(isFollowUpOpen({ completed_at: null }), true);
  assert.equal(isFollowUpOpen({}), true);
});

void test('real reminder evaluator suppresses completed due, overdue and agenda mail', () => {
  const source = readFileSync(
    new URL('../supabase/functions/emt-reminders/index.ts', import.meta.url),
    'utf8',
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const evaluate = runInNewContext(`${compiled}\nbuildCandidates;`, {
    exports: {},
    require: (name: string) => {
      if (name.endsWith('emt-completion.ts')) return { isFollowUpOpen };
      if (name.includes('supabase-js'))
        return {
          createClient: () => {
            throw new Error('Network forbidden in test');
          },
        };
      if (name.endsWith('emt-email-template.ts')) return {};
      if (name.startsWith('jsr:')) return {};
      throw new Error(`Unexpected dependency: ${name}`);
    },
    Deno: { serve: () => {} },
  });
  const settings = [
    {
      member_email: 'member@example.test',
      reminders_on: true,
      agenda_reminder_timing: '2 business days before',
      followup_reminder_timing: '1 business day before',
      overdue_reminders_on: true,
      business_days_only: true,
    },
  ];
  const members = [
    {
      display_name: 'Synthetic Owner',
      email: 'member@example.test',
      active: true,
    },
  ];
  const topic = {
    id: 1,
    bucket: 'agenda',
    title: 'Synthetic test',
    category: 'Operations',
    lead: 'Synthetic Owner',
    prep_action: '',
    decision: 'Approved',
    follow_up_owner: 'Synthetic Owner',
    follow_up_action: 'Perform action',
    due_date: '2026-10-20',
    meeting_date: '2026-10-21',
    completed_at: null,
  };
  assert.equal(evaluate('2026-10-19', settings, members, [topic]).length, 2);
  assert.equal(
    evaluate('2026-10-19', settings, members, [
      { ...topic, completed_at: '2026-10-19T00:00:00Z' },
    ]).length,
    0,
  );
  assert.equal(
    evaluate('2026-10-19', settings, members, [
      {
        ...topic,
        due_date: '2026-10-16',
        completed_at: '2026-10-19T00:00:00Z',
      },
    ]).length,
    0,
  );
  assert.equal(
    evaluate('2026-10-19', settings, members, [
      {
        ...topic,
        bucket: 'history',
        due_date: '2026-10-16',
        completed_at: null,
      },
    ]).length,
    1,
  );
});
