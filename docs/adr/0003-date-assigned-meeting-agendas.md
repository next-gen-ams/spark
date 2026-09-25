# ADR 0003: Assign agenda topics to explicit meeting dates

**Date**: 2026-09-25
**Status**: Accepted
**Deciders**: Coco Hu and Codex

## Context

EMT meetings run every second Monday, but the original tracker stored every upcoming item in one undated `agenda` bucket. That model cannot show three future meetings, schedule a topic beyond the next meeting, or calculate preparation reminders against the topic's actual meeting. It also leaves unfinished items ambiguous after a meeting passes.

## Decision

Agenda topics use an explicit `meeting_date` aligned to the fortnightly EMT schedule. The homepage shows a rolling three-meeting window, retains the current meeting for the full Melbourne calendar day, and lets users move a topic to the following meeting. After a meeting date passes, undecided topics return to the discussion backlog and decided topics move to history.

## Alternatives Considered

### Keep one undated agenda bucket

- **Pros**: No schema migration and minimal interface change.
- **Cons**: Cannot plan more than one meeting or send date-correct reminders.
- **Why not**: It does not support the requested three-meeting planning workflow.

### Automatically carry every unfinished topic to the next meeting

- **Pros**: No item becomes unscheduled.
- **Cons**: The system silently changes the executive team's agenda and may repeatedly carry low-priority items.
- **Why not**: Returning undecided items to the backlog makes the next scheduling decision explicit.

## Consequences

### Positive

- Each preparation reminder is tied to the selected meeting date.
- The current meeting remains usable for the whole meeting day.
- Unfinished items remain visible and recoverable without silently occupying a future agenda.

### Negative

- Topic writes must validate a meeting date as part of the fortnightly schedule.
- The workspace and reminder services must run the same expired-agenda rollover rule.

### Risks

- A missed rollover could leave a stale agenda item; both workspace loading and the scheduled reminder evaluator invoke the idempotent rollover function.
- A mismatched date could create an off-cycle meeting; the backend validates every agenda date against the configured anchor.
