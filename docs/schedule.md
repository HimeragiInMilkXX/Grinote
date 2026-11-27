# Project schedule (MVP 6.0)

The user assigns tree tasks to days themselves. The AI never builds a schedule on its own: it only helps through the assistant drawer (`list_schedule` / `propose_schedule`), and every AI change is a draft the user ticks and applies.

## Data

`schedule_items` (`supabase/migrations/20261129000001_schedule_items.sql`):

| column | meaning |
|---|---|
| `project_id`, `user_id` | owner (RLS: owner only) |
| `node_id` | the task, `on delete cascade` |
| `scheduled_for` | the day (`date`, Tokyo day) |
| `done_at`, `record_id` | set when the task report is confirmed |

One row = one planned session. A repeating task can have several rows (also on the same day).

### Rules (enforced in `normalizeScheduleOps` and in the DB trigger `schedule_items_guard`)
- Any open action can be scheduled: one-time or repeating, also one whose subtasks aren't done yet (warning; it can't be started before them). The root and label nodes can't.
- One-time task: at most one open entry. Repeating task: `repetitions_completed + open entries ≤ repetitions_required`. Done entries don't count (the node's `repetitions_completed` already does).
- New or moved entries: today or later (Tokyo), not after the target date (a past target date doesn't limit).
- Done entries are frozen: no move, no edit, no delete (RLS delete policy `done_at is null`, trigger `schedule_done_locked`). FK cascades (deleting a node or the project, `reset_project_progress`) still remove them.
- Over the daily goal (`daily_time_goal`) or on a non-work day: warning only.
- Error codes are mapped to Japanese by `describeScheduleError` (`src/lib/schedule/errors.ts`).

### Completion
`complete_task_with_reward` sets the record to `completed`; the trigger `records_tick_schedule` then stamps the **earliest open entry** of that node (by day, then creation), whatever its day. It runs in the same transaction, so no app code ticks entries.

### Entry states (`buildEntries`, `src/lib/schedule/rules.ts`)
- `open`: not done, today or later.
- `carried`: not done, its day has passed. Shown on today as 持ち越し, still counts toward the limit; can be moved or removed.
- `done`: ticked.
- `stale`: not done but its node is completed / no longer an action (e.g. repetitions lowered). Doesn't count in totals; can be removed.

Day totals (`dayTotal`) sum `time_limit` (one session) of the day's non-stale entries; `00:00:00` counts 0 (目安なし).

## Code
- Pure, unit-tested (`src/lib/schedule/schedule.test.ts`): `rules.ts` (nodes, capacity, entries), `days.ts` (`entriesForDay`, `dayTotal`, `scheduleWeeks`), `normalize.ts` (`normalizeScheduleOps`, `dayChanges`), `gate.ts`.
- Server: `data.ts` (`loadScheduleView`, `loadScheduleGate`, `dayCountsOf`), `actions.ts` (`getScheduleView`, `applyScheduleChanges`: re-validates on fresh data, then removes → moves → inserts).
- Page `/project/[id]/schedule`: `components/project/schedule/` (`schedule-board.tsx` week carousel, `schedule-week.tsx`, `schedule-day-sheet.tsx`, `schedule-task-picker.tsx`). Changes save immediately; no unsaved state. With a goal date of today or later the weeks end at the goal week (`scheduleWeeks`); days after the goal are muted and read-only like past days (one still holding entries stays openable to move/remove them). No goal or an overdue goal: `SCHEDULE_MIN_WEEKS_AHEAD` weeks ahead.
- Dashboard: `project-dashboard-schedule.tsx` (today's remaining tasks with スタート + the next 2 planned days) and `予定 残りN` on each day card.
- Tree: nodes with pending entries today (carried ones included) get a violet outline and a `今日` / `今日 ×N` / `持ち越し` badge under the node; the tooltip says サブタスク待ち for blocked ones. `todayHighlights` (`days.ts`) → `loadTodayScheduleHighlights` (tree page, never throws) → `scheduleTodayHighlightAtom` (display only, never saved). `flow-client.tsx` reloads it with `getScheduleView` after a save with changes and when `scheduleVersionAtom` bumps. It sits together with the next-action ring.
- Account `/calendar`: days are selectable (`calendar-view.tsx`); `buildDayPanel` (`src/lib/calendar/day-panel.ts`) lists each project's unfinished tasks of the focused day in tree order, its next planned day and its next action; blocks show a count badge (`pendingCounts`).
- Assistant: `list_schedule` (read-only) and `propose_schedule` (draft, validated by `normalizeScheduleOps`; card `components/assistant/parts/schedule-parts.tsx` applies ticked changes with `applyScheduleChanges` and bumps `scheduleVersionAtom`). Page context `schedule` (+ open `day`).

## Next action gate
The AI next action only pops up by itself (task complete page, tree save) when the schedule leaves a gap (`scheduleGate`, `src/lib/schedule/gate.ts`):
- allowed when today has no unfinished entries, or
- when the "next day" has none. The next day is today while today's focus hasn't reached `daily_time_goal` (no goal = not reached), otherwise the next work day.

`loadNextActionSummary` returns `scheduleGate`; `afterTreeSave` ANDs it into `ask`. The dashboard's manual button is never gated, it only shows a hint. If the schedule can't be read, the gate stays open.
