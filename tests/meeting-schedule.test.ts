import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addMeetingWeek,
  buildMeetingSchedule,
} from '../lib/meeting-schedule.ts';
import { isWeeklyMeetingDate } from '../supabase/functions/_shared/emt-meeting-schedule.ts';

const ANCHOR = '2026-09-14';

void test('shows the next three weekly meetings on a normal day', () => {
  const schedule = buildMeetingSchedule(
    new Date('2026-09-29T03:00:00Z'),
    ANCHOR,
  );
  assert.deepEqual(
    schedule.map((meeting) => meeting.iso),
    ['2026-10-05', '2026-10-12', '2026-10-19'],
  );
  assert.equal(schedule[0].countdownDays, 6);
  assert.equal(schedule[0].isToday, false);
});

void test('keeps the current meeting first for the full Melbourne calendar day', () => {
  const early = buildMeetingSchedule(new Date('2026-10-04T16:30:00Z'), ANCHOR);
  const late = buildMeetingSchedule(new Date('2026-10-05T13:30:00Z'), ANCHOR);
  assert.equal(early[0].iso, '2026-10-05');
  assert.equal(late[0].iso, '2026-10-05');
  assert.equal(early[0].isToday, true);
  assert.equal(late[0].isToday, true);
});

void test('advances to the next meeting after the Melbourne meeting day', () => {
  const schedule = buildMeetingSchedule(
    new Date('2026-10-05T14:30:00Z'),
    ANCHOR,
  );
  assert.equal(schedule[0].iso, '2026-10-12');
  assert.equal(schedule[0].isToday, false);
});

void test('moves a topic exactly one week forward', () => {
  assert.equal(addMeetingWeek('2026-10-12'), '2026-10-19');
});

void test('backend accepts each weekly Monday and rejects off-cycle dates', () => {
  assert.equal(isWeeklyMeetingDate('2026-10-05', ANCHOR), true);
  assert.equal(isWeeklyMeetingDate('2026-10-12', ANCHOR), true);
  assert.equal(isWeeklyMeetingDate('2026-10-06', ANCHOR), false);
});
