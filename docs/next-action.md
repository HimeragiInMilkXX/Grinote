# AI suggested next action (MVP 5.5)

The assistant suggests **what to do next**, chosen from the tasks already in the goal tree. It never creates tree nodes (adding tasks is `propose_goal_tree`'s job).

## Plan types
- `progress` (進捗タスク): one task that moves the goal forward, usually a one-time task.
- `practice_progress` (練習＋進捗): one repeating (loop) task as practice plus one one-time task. It's only possible when a startable loop exists. The AI picks the type.

Only **startable** nodes can be picked (`buildCandidates`, `src/lib/next-action/candidates.ts`): an action that isn't completed and isn't the root, whose direct children are all completed. That's the same rule as `startTask`. The model sees short keys (`c1`, `c2`, …) and never the uuids.

## What the model reads (`prompt.ts`)
- The goal tree outline: done, waiting for subtasks, group, startable with its key, loop progress.
- The candidates, with path, estimate, loop progress and note.
- Today, on the Tokyo day: focus time (`todayFocusMs`), the daily goal and the time left, whether today is a work day, the next work day (`nextWorkDayKey`) and the goal date.
- The journey: completed tasks, total focus, current streak, and the last 5 AI summaries (`toHistorySummary`, no evidence).
- The situation (task completed / tree saved / manual) and the user's choice.
- On revisions: earlier suggestions plus the user's feedback.

User text goes inside `<user_…>` tags and is cleaned with `sanitizeUserText`. The output is a flat loose zod schema (`schema.ts`). `normalizeNextAction` (`normalize.ts`) maps keys to nodes and enforces the rules:
- The main task is non-loop whenever one exists. A loop placed in the main slot is swapped.
- The practice is a different loop task.
- Unknown keys are rejected and retried with a note.

`generate.ts` runs it like the report analysis: the same model chain (`getJourneyModelId`), `temperature: 0` for local models, `parseLooseJson` salvage, one retry. It never throws.

## Scheduled day (`schedule.ts`)
After a task completion the popup offers three choices:
1. 次の作業日にやる: the next work day.
2. まだ続けて新しいタスクを始める: today.
3. わからない: the model decides.

After a tree save, or a manual request, the model also decides. If the model's day is missing or invalid, the fallback is today when it's a work day and time is left, otherwise the next work day. When there's no work day left before the goal date, the day is today. A user's own plan may pick any day from today to the goal date (`isPickableDay`).

## Draft flow (`actions.ts`, `"use server"`)
- `startNextActionDraft(projectId, origin, intent)`: an older open draft becomes `expired`, then a new draft is created and generated (generation 1).
- `reviseNextAction(projectId, draftId, feedback)`: regenerate (empty feedback) or revise. At most `NEXT_ACTION_MAX_REVISIONS` (3) times, so at most 4 generations. A generation is counted **before** the model runs (optimistic `generation_count` check), so double clicks can't exceed the limit. A failed run gives the count back.
- `saveNextAction(projectId, draftId, edits?)`: save as suggested, or edited. Edited plans become `source: 'user'`. Older `saved` rows become `replaced`.
- `createManualNextAction`: the user's own plan without the AI.
- `rejectNextAction` / `clearSavedNextAction`.
- `afterTreeSave(projectId)` returns `{ ask, highlights }`.

The current plan of a project is its latest `saved` row. `resolvePlan` (`resolve.ts`) reads it against the current tree. Each item is one of:
- `ok`
- `done`: completed while the plan was saved
- `missing`: deleted
- `blocked`: an incomplete child was added
- `completed`: finished elsewhere

`stale` means some item is missing, blocked or completed.

`confirmReport` calls `markNextActionProgress` after the reward. It stamps `progress_done_at` / `practice_done_at` when the completed node is in the plan. This is best-effort and never blocks the XP.

## Where it shows
- **Task complete page**: the `NextActionPrompt` card. On the first view, when there are startable tasks, the popup opens by itself after the XP animation (3.2 s).
- **Goal tree**: after a save that had changes, the popup asks **only when needed**: there's no plan, or the plan is finished or stale (`shouldAskForPlan`). Plan nodes get an amber (進捗) or sky (練習) ring and a 次：… badge through `nextActionHighlightAtom`. That's display only and never saved.
- **Project dashboard**: `ProjectDashboardNextAction` shows the plan with スタート → `/project/[id]/onair?nodeId=` (the timer picker). Start is disabled while a task is active or a report is pending. It also has 決め直す / 取り消す, 次のアクションを作成 (origin `manual`), and resume for an open draft.
- **Calendar**: a 今日 / 明日 panel under the weekly calendar (`buildNextActionDays`, `src/lib/calendar/next-actions.ts`). Every project is listed with its color. Its plan shows on its day. An unfinished plan from an earlier day carries over to 今日 (持ち越し). Rows open the tree.

## DB (`supabase/migrations/20261128000001_next_actions.sql`)
`next_actions`:
- One row per suggestion session.
- `status`: draft / saved / rejected / replaced / expired.
- `origin`, `intent`, `kind`, `source`.
- The node ids (`on delete set null`) plus task name snapshots.
- Reasons, message, `scheduled_for`, `generation_count` (0–4), `history`, `model`, the done stamps, `saved_at`.

Constraints and rules:
- One open draft per project (a partial unique index).
- RLS on the own `user_id`. Insert also checks project ownership.
- The guard trigger freezes `project_id`/`user_id` and checks that picked nodes belong to the project (`next_action_foreign_node`).
- `reset_project_progress` deletes the project's rows. Deleting a project cascades.
