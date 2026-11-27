# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Grinote" MVP: a goal-tracking app. Each project has a goal tree (a React Flow graph of tasks), materials (files and memos), a timed "on air" work session, a task report + journey timeline (reflections, AI effort review), and a growth character (Rive animations) that levels up as tasks are completed. An AI assistant drawer can read the project and its journey and propose additions to the goal tree. The UI text is mostly Japanese.

## Commands

- `npm run dev`: dev server on http://localhost:3000
- `npm run build` / `npm run start`
- `npm test`: Vitest unit tests (`src/**/*.test.ts`, node env, `@/` alias via `vitest.config.ts`). No lint script. Use `npm run build` (or `npx tsc --noEmit`) to type-check.
- `npm run eval:tree`: slow model eval (`scripts/eval-tree-agent.eval.ts`, `vitest.eval.config.ts`) that runs scripted tree-edit requests against local Ollama models with a fixture graph. `EVAL_MODELS=a,b` limits models, `EVAL_OUT=path.json` writes the report. Not part of `npm test`.
- `npm run eval:journey`: same setup for the task report analysis (`scripts/eval-journey.eval.ts`: effort, failure-but-tried, streak farming, prompt injection, clarify cases).
- `.npmrc` sets `legacy-peer-deps=true` because `use-undoable` declares only React 17/18 peers. Keep it.

Env vars (in `.env*`, which is gitignored): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `GEMINI_API_KEY` (Google AI Studio key for Gemini; without it Gemini is hidden and GPT-OSS becomes the default), `AI_BASE_URL` (default `http://localhost:11434/v1`, Ollama), `AI_API_KEY`, `TAVILY_API_KEY` (web_search tool), optional `JOURNEY_AI_MODEL` (report analysis model, default `DEFAULT_MODEL`).

## Stack notes

- Next.js 16 App Router + React 19, with the React Compiler on (`reactCompiler: true`). Server Actions body limit is 1gb for media uploads.
- Middleware lives in `src/proxy.ts` (`export function proxy`), the Next 16 name for it, not `middleware.ts`. It refreshes the Supabase session on every route.
- Tailwind v4 (CSS-only config in `src/app/globals.css`) and shadcn with the `base-nova` style on `@base-ui/react`, not Radix. Generated primitives go in `src/components/ui`. There's an extra `@videojs` shadcn registry; its components are in `src/components/videojs`.
- Path alias: `@/*` → `src/*`.
- State: Jotai atoms in `src/atoms`.

## Architecture

### Supabase clients (`src/utils/supabase/`)
- `server.ts` `createClient()`: for Server Components and reads. Its `setAll` is a no-op.
- `actions.ts` `createActionClient()`: for Server Actions that write or change auth. It writes cookies.
- `client.ts`: browser client. `middleware.ts`: used by `proxy.ts`.
- Auth guards: `redirectIfNotAuthenticated(path)` / `redirectIfAuthenticated` in `src/utils/`, called from layouts.
- Tables in use: `projects`, `nodes`, `materials`, `material_nodes`, `records` (with `timer` jsonb), `task_journals`, `resources`, `project_resources`, `profile`, `characters`. RPCs: `reset_project_progress`, `complete_task_with_reward`, `add_character_xp`. Storage bucket: `materials_media`. There's no full schema in the repo; changes since the project settings feature are kept as SQL files in `supabase/migrations/` (applied through the Supabase MCP or the SQL editor).

### Materials
- `materials` has `is_favourite` and `pinned_at` (null = not pinned; pins are ordered by it). The pin limit is `MATERIAL_PIN_LIMIT` in `src/lib/materials/config.ts`, enforced in `setMaterialPinned`. `getProjectMaterials` excludes pinned rows; `getPinnedMaterials` lists them above the table regardless of search/filter.
- `material_nodes(material_id, node_id, project_id)` links materials to tree nodes. Both FKs are `ON DELETE CASCADE`, so deleting a node (via `saveGraphToNodes`) or a material removes its links; no app code does this. Links are written straight to the DB (`setMaterialNodeLinks` / `setNodeMaterialLinks`), not through the tree save, and only saved nodes can be linked.
- `MaterialViewer` (`components/material/material-viewer.tsx`) renders any material with `MaterialViewerHeader` (favourite/pin/link) and a `MemoSection` (the `content` column) under every non-memo type. It's shared by the material tabs and `LinkedMaterialsList` (sheet viewer used in the node panel and on-air).
- Memo images go to `materials/{id}/memo/`; `clearUnusedImages` only cleans that folder, never the material's main file. `RichTextEditor` needs `material_id`.
- Unsaved memos: `RichTextEditor`'s `onChange` fires on user edits and inserted AI drafts (loading `content` uses `emitUpdate: false`). `useUnsavedMemo` keeps dirty material ids in `memoUnsavedAtom`; the memo editors show a notice, the tab trigger shows a red dot, and closing a tab, closing the material sheet, leaving via `project-navigation.tsx`, or reloading asks first. Material tab panels use `keepMounted` so switching tabs doesn't drop edits.
- The root node can't hold materials: pickers hide it, the link server actions and `normalizeMaterialOps` (`rootIds`) reject it, and the `material_nodes` RLS `with check` refuses root nodes.
- Bulk create: dropping files on the list sets `materialCreateQueueAtom`; `create/material-create-panel.tsx` queues them with `detectMaterialType` (`src/lib/materials/detect-type.ts`) and each item must be confirmed before 全て保存. List reloads are driven by `materialListVersionAtom`.

### Project settings
- `project/[projectId]/settings`: `ProjectSettingsPanel` (view mode → 編集 → 保存/キャンセル) and `ProjectDangerZone` (reset / delete) in `components/project/settings/`. Editable: `name`, `description`, `achieve_date_goal`, `daily_time_goal`, `work_days`, and `character_given_name` once. Never editable: `final_goal`, `character_id`, level/XP.
- Rules live in `src/lib/projects/settings.ts` (`buildSettingsPatch`, unit-tested). It's used both as the form's resolver and in the `updateProjectSettings` server action. A changed target date must be today or later; an unchanged one isn't re-checked.
- DB safety net: the `BEFORE UPDATE` trigger `projects_guard_settings` raises `project_locked_field` / `project_character_name_locked` / `project_active_task` (mapped to Japanese by `describeProjectSettingsError`). It stamps `character_name_changed_at` on the first rename. XP/level/tutorial updates pass through.
- No settings change, reset or delete while the project has a `records` row in `active`/`paused`/`reviewing` (a pending task report counts as an active task).
- Reset is the RPC `reset_project_progress` (security invoker). It deletes non-root nodes (with records and material links), records and `project_resources`, and sets XP 0 / Lv 1 / streak 0. It keeps settings and materials.
- `deleteProject` removes storage files under `materials/{id}/` and `materials/{id}/memo/` first (storage RLS needs the material rows), then deletes the project. Everything else cascades, including `materials`.
- Unsaved edits: `projectSettingsDirtyAtom` (read by `project-navigation.tsx`) plus `beforeunload` via `useUnsavedSettings`.
- `work_days` is `smallint[]` of ISO weekdays (1 = Mon … 7 = Sun), sorted and unique, with a CHECK constraint. Use the helpers in `src/lib/projects/work-days.ts` (`WEEKDAYS`, `normalizeWorkDays`, `isWorkDay`, `workDayNames`).

### Project colors and calendar
- `projects.color` (required) is a palette key. The palette is `PROJECT_COLORS` in `src/lib/projects/colors.ts` (literal Tailwind classes: `solid`/`soft`/`dot`/`accent`); the CHECK `projects_color_check` (`supabase/migrations/20261127000001_project_color.sql`) lists the same keys, and `colors.test.ts` checks they match. `pickDefaultColor` preselects the first unused color in the wizard; `ProjectColorPicker` is shared by the wizard and settings. Color is a normal settings field (not in the guard trigger).
- `/calendar` (link on `/dashboard`): weekly view of every project. Logic is pure in `src/lib/calendar/week.ts` (unit-tested): weeks start Monday, Tokyo days (`CALENDAR_TIMEZONE`), `CALENDAR_WEEKS_AROUND` (n, in `config.ts`) weeks on each side of the current one. A project is scheduled on its `work_days` from its creation day to `achieve_date_goal`; a non-abandoned record started or ended that day marks it worked (✓), work on an unplanned day is an `extra` (dashed) entry, and the goal day gets a flag. `getCalendarData` (`app/calendar/serverActions.ts`) loads everything for the range once; `components/calendar/weekly-calendar.tsx` pages through it with the embla `Carousel` (swipe/drag, buttons, ←/→, 今週). Blocks link to `/project/[id]/tree`.

### Route conventions
Each route folder keeps its own `serverActions.ts` (`"use server"`, Supabase access) and `clientActions.ts` (client-only helpers) next to `page.tsx`. Shared domain types in `src/types/*.ts` (e.g. `Project`, `Character`) are mostly **ambient globals**, not exported, so they're used without imports.

Main routes: `(auth)/login|signup`, `dashboard` (project list), `project/new/{goal,details,character,complete}` (a wizard whose state lives in `new_project_atom`), and `project/[projectId]/{dashboard,tree,materials,onair,task_report,task_complete,journey,character,settings}`. `project/[projectId]/layout.tsx` loads the project, then mounts the navigation, the tutorial panel, and the assistant (`ChatProvider` + `AssistantDrawer`).

### Goal tree
- Client: `src/components/flow/` (`flow-client.tsx`, `task-node.tsx`). Nodes are `TaskNodeType = Node<{label, task: Task}, 'taskNode'>` (`src/types/flow.ts`). Auto-layout uses dagre (`tree/clientActions.ts`).
- Persistence: `tree/serverActions.ts` `saveGraphToNodes` turns the React Flow JSON into flat `nodes` rows (`pos_x/pos_y`, `parent_node_id` taken from edges, `time_limit` stored as a Postgres interval via `durationObjectToInterval`/`intervalToDurationObject` in `src/utils/utils.ts`), then upserts and deletes rows to match. Edges aren't stored, only `parent_node_id`.
- Node ids: `nodes.id` is a global uuid PK, so always create ids with `newNodeId(taken)` from `src/lib/tree/ids.ts` (works without `crypto.randomUUID` over plain http), never `crypto.randomUUID()` directly. JSON import gives every pasted node a fresh id. `saveGraphToNodes` sanitizes ids (`sanitizeGraphIds`), upserts only rows already in this project, plain-inserts new rows (a row of another project is remapped, never overwritten), and returns `{ idMap }` that `flow-client.tsx` applies to the canvas.
- Domain rules: exactly one `isRoot` node, and an action parent can't start until all its direct children are complete.

### AI assistant
- `src/app/api/chat/route.ts`: Vercel AI SDK v7 `streamText`. Models are listed in `src/lib/ai/models.ts` (client-safe: `provider`, picker `group`). The default is **Gemini 4 Hydrogen** (`gemini-4-hydrogen`, `@ai-sdk/google`, `GEMINI_API_KEY`); GPT-OSS / Qwen / Gemma run on Ollama through the OpenAI-compatible provider (`src/lib/ai/provider.ts`).
- Fallback: `getModelWithFallback` wraps the chain from `getModelChain` (Gemini → `FALLBACK_MODEL_IDS`; a local model has none) in `createFallbackModel` (`src/lib/ai/fallback.ts`, unit-tested). It switches only when a model fails before any output, never after an abort, and sticks to the model that worked for later steps. The route puts the model that answered in `metadata.answeredBy` (only when it differs), and `chat-message.tsx` shows a note. `getAvailableModels()` (used by the project layout) hides Gemini while the key is missing. Report analysis uses the same chain; `temperature: 0` goes to local models only. Each request carries `project_id`, which goes into `generateSystemPrompt` (`src/lib/ai/system-prompt.ts`). It stops after 8 steps.
- Tools are in `src/tools/` and registered in `src/tools/index.ts`, which also exports the `ChatUIMessage` type and the per-tool part types. To add a tool: create it with `tool()` + zod, add it to `baseTools`, export a `tool-<name>` part type, and add a renderer in `src/components/assistant/parts/` wired into `components/assistant/chat-message.tsx` (import, `StepPart`, the switch, `isStepPart`).
- Journey tools: `list_journey` / `read_journey_entry` (read-only; reflections + AI summaries, never evidence; renderer `parts/journey-read-part.tsx`).
- `ask_user` and `propose_goal_tree` are human-in-the-loop. `propose_goal_tree` drafts full CRUD on the tree as four op lists (`add` / `update` / `move` / `delete`). "Break a connection" is a `move` (single-parent tree, no orphans allowed). Its `execute` loads the saved graph, runs `normalizeOps` + `applyTreeChanges` from `src/lib/tree/tree-changes.ts`, throws on rule violations (the model sees the error and retries), and returns normalized ops + a diff. `toModelOutput` sends the model a short text summary only.
- Tree rules (enforced in `tree-changes.ts`, unit-tested): the `isRoot` node is never edited, deleted, or given a parent, and every node must descend from it; `isCompleted` nodes are never edited, moved, deleted, or connected to; loops with `repetitions_completed > 0` are "protected" and change only if the user ticks them on the review card (`allowedProtectedIds`, `withoutOpsFor`). Deleting a node moves its children up to its parent unless they're moved or deleted too. Deleting also cascades the node's `records`.
- Review flow: `components/assistant/proposal-question-card.tsx` (counts, protected-loop checkboxes, warnings) → `graph_edit_request_atom` holds `{ops, allowedProtectedIds, warnings}` → `flow-client.tsx` re-applies the ops to the *current* canvas and shows `flow/generated/requested-update-confirmation-dialog.tsx` (preview via `buildPreviewGraph`, colored per change, tooltips with before→after). Other atoms: `graph_edit_reviewed_proposal_atom`, `tree_requires_save_action_atom` (used by `components/navigation/project-navigation.tsx`). Nothing is saved until the tree is saved.
- `saveGraphToNodes` is the server-side safety net: root/completed rows are never deleted and only their position is written, and `isRoot`/`isCompleted`/`repetitions_completed` always come from the DB (a stale canvas can't undo progress). AI add keys always become fresh ids in `normalizeOps` (a model-sent UUID is never kept), and `flow-client.tsx` re-keys an accepted draft with `rekeyAddOps` if a key collides with the current canvas; `buildPreviewGraph` never returns duplicate node/edge ids.
- When you change tool schemas, keep the system prompt and the zod `.describe()` text consistent. They're tuned for small local models (Gemma/Qwen).
- Material tools: `list_materials` / `read_material` (metadata + memo as plain text; uploaded file contents are not read), `propose_materials` (draft of new external links, link/unlink, suggestions; validated by `normalizeMaterialOps` in `src/lib/materials/proposal.ts`; the inline card in `parts/propose-materials-part.tsx` writes ticked items immediately via `applyMaterialProposal`), and `draft_memo` (Markdown → HTML via `src/lib/materials/markdown.ts`; the card sets `memoDraftRequestAtom`, and `useMemoDraft` writes it into the editor unsaved). Reviewed card ids live in `materialProposalReviewedAtom`.
- Fallbacks: the route wraps the run in `createUIMessageStream` and writes the `finish` chunk itself with `metadata.finishReason` (and `autoRetried`). If a turn returns only reasoning (no text, no tool call), it silently re-runs once with a hidden nudge. Errors are logged and mapped to Japanese text by `describeChatError` (`src/lib/ai/errors.ts`). On the client, `getReplyIssue` (`src/lib/ai/reply-status.ts`) checks the last turn for error / stopped / interrupted (no `finishReason`) / empty / length / step-limit. `useStallDetector` flags a reply with no new chunk for 45 s. `components/assistant/reply-fallback.tsx` shows the card with 再試行 / 続きを生成 / 続ける / 停止して再試行.
- The client sends `context` (`assistantPageContextAtom`: open material / on-air node) with every chat request; `parsePageContext` validates it and `generateSystemPrompt` adds it. The route stops after 8 steps.

### Task report and journey (MVP 4.0)
Full details, including the guide for the evidence feature, are in `docs/journey-system.md`.
- Record status flow: `active` ⇄ `paused` → (完成, `finishTask`) `reviewing` → (confirm) `completed`, or `abandoned`. `reviewing` means the timer is stopped and the report is pending, with no XP yet. `records.ended_at` is when 完成 was pressed; streak days and `completed_at` use it. At most one open record (`active`/`paused`/`reviewing`) per project, enforced by a unique index. A pending report blocks starting tasks, tree edits, settings and reset (`getPendingReport`).
- `task_journals` (1:1 with `records`, cascades with it) holds:
  - a task snapshot
  - the 3 reflections
  - `clarifications` (`[{round, question, answer, skipped}]`)
  - `analysis` (`JourneyAnalysis`, with the reflections it was based on, written back on confirm), `ai_score`, `analysis_status` (`draft | analyzing | needs_clarification | analyzed | failed | confirmed | confirmed_without_ai`), and the limits (3 analyses per record in total, 2 clarification rounds)
  - `evidence`/`verification`, reserved
  `finishTask` creates it with the task snapshot (the reward uses its estimate). The insert guard forces an empty draft; the update guard freezes confirmed journals; only `complete_task_with_reward` confirms them. Journal queries are in `src/lib/journey/journal-db.ts` (optimistic `updated_at` check, `recoverStaleJournal` for interrupted runs).
- `task_report/serverActions.ts`: `analyzeReport` → `runJourneyAnalysis` (`src/lib/journey/analyze.ts`: `generateText` + `Output.object` through `getStructuredModel`, `temperature: 0`, never throws). `confirmReport` → `awardTaskCompletion`. `resumeWork` returns the record to `paused` and keeps the analysis. Once analysed, a record always keeps a usable analysis, so it can't get stuck. After a failed analysis the user may claim without AI (score null, ×1.00).
- The score is effort-focused: relevance 30 + attempt 40 + seriousness 30. The parts are clamped and **summed in code** (`normalizeAnalysis`); verification is set in code (`self_report` until evidence exists). Reflections go to the model inside `<user_…>` tags as data. Keep the prompt (`src/lib/journey/prompt.ts`) and the zod `.describe()` texts consistent.
- Journey page: `getJourney` → `loadJourneyEntries` + `computeJourneyStats` (total work time, completed tasks, current/longest streak via `computeCurrentStreak`/`computeLongestStreak`, start day). Entries are collapsible (`components/project/journey/`). Records before 4.0 have no journal and show 旧バージョン.
- Assistant: `list_journey` / `read_journey_entry` (`src/tools/`) return reflections and AI summaries, **never evidence**. The analysis prompt also gets the last 5 AI summaries (`toHistorySummary`).
- The dashboard 記録一覧 dialog was removed; the dashboard links to the journey and to a pending report.

### Work timer (MVP 4.5)
- Four modes (`src/lib/timer/config.ts` `TIMER_CONFIG` / `TIMER_MODE_INFO`): ポモドーロ 25/5 (15-min long break every 4 completed sessions), 50/10, 10分スターター (10-min countdown, then count-up), フロータイム (count-up, suggests a 10-min break every `flowSuggestMin`, default 50).
- The whole state is `records.timer` (jsonb `TimerState`, `src/lib/timer/types.ts`), changed only by `applyTimerEvent` (`src/lib/timer/machine.ts`, unit-tested) inside the `timerAction` server action, with server time and an `updated_at` check. `records.duration` mirrors focus ms (`totals.workMs`); `status` is `active` in work, `paused` otherwise. Pre-4.5 open records get `legacyTimer` (flowtime). The client only reads it: `timerView` (`view.ts`) + `useServerClock`.
- Flow: tree スタート → `/onair?nodeId=` shows `TimerStartPanel` (picker) → `startTask(node, project, choice)` creates the record. No record is created during a page render.
- Concepts: a session is a work interval between breaks (pauses don't split it). Breaks are scheduled (countdown) or custom (休憩する: hidden count-up, notice every 5 min). Pause (一時停止, optional reason) is not a break: not in focus, break or total (total = focus + break). Waiting at a 休憩しますか？ offer counts as break time; a skipped offer isn't a break.
- Rules: a countdown session closes exactly at its scheduled end (`session_due`, whenever the client reports it). Pomodoro: a mid-session break voids the session for the long-break cycle. 50/10 and the starter resume the remaining time after a break. A scheduled break that runs over by at most `TIMER_BREAK_OVERRUN_GRACE_MS` (server-only, `server-config.ts`, default 10 s) ends on time; beyond, the whole overrun is break. The timer can change only in a break; `FREE_TIMER_CHANGES` (3), then every change resets all timer stats (`modeHistory` keeps every timer, `reset: true`). Leaving the starter is always free; after its 10 minutes the starter can't resume work without switching (`starter_switch` keeps the same session).
- UI: `components/project/onair/onair-timer.tsx` + `onair/timer/` (picker, dialogs, `timer-notify.ts`: sonner + WebAudio beep + browser Notification when hidden). Summary: `components/project/timer/timer-summary.tsx`.

### Rewards / XP
Full details are in `docs/reward-engine.md`, and the AI placeholder is covered in `docs/ai-review-integration.md`.
- Task XP follows the Reward Engine v1.0 formula: `calculateTaskReward` in `src/lib/rewards/engine.ts`. All constants are in `src/lib/rewards/config.ts` (`REWARD_CONFIG`, `REWARD_FORMULA_VERSION`, `REWARD_DAY_TIMEZONE`, `LEVEL_XP_REQUIREMENT_SCALE`, `TASK_COMPLETION_RESOURCES`). The spec acceptance tests are in `engine.test.ts`.
- XP is awarded once, on the server, when the task report is confirmed. `confirmReport` → `awardTaskCompletion` (`src/lib/rewards/award-task.ts`) → RPC `complete_task_with_reward` writes the record, node progress, XP, level, streak, resources and the journal confirmation in one transaction. It needs a `reviewing` record with an analysed (or failed) journal. It's idempotent (an already completed record awards nothing), and an `xp_conflict` means the reward is recomputed. The task_complete page never writes XP. `markRewardShown` only sets `reward_redeemed` ("animation shown").
- `records.reward_breakdown` (`TaskRewardBreakdown`, `src/lib/rewards/breakdown.ts`) snapshots the inputs, factors, config, and the XP/level before and after. `TaskRewardBreakdownCard` renders it. Never recompute past rewards.
- Streak rules are in `src/lib/rewards/streaks.ts`. The project streak is work-day aware and saved to `projects.streak`. The task streak counts today's earlier completions and is reset by an abandoned task. Both use the Tokyo day.
- `src/lib/rewards/ai-review.ts` reads the analysed journal (`journalToAiReview`): `source: "ai"` with the score, model, conclusion and verification, else `null` (factor ×1, shown as AI分析なし). The RPC checks that the snapshot score matches `task_journals.ai_score`. Never present a simulated score as an AI review.
- Other XP gains (feeding) go through `addCharacterXp` → RPC `add_character_xp`. Never write `character_xp`/`character_level` directly from the client.

### Assets
Character Rive files: `public/character/rive/<characterId>/<level>.riv` (levels 1/5/10/25/45/50), with thumbnails in `public/character/thumbnail/`. Level logic is in `src/lib/character/level.ts`, the single source for both server and client:
- Total XP is authoritative, and `character_level` is a cache written by the server.
- The curve is `growth_step × LEVEL_XP_REQUIREMENT_SCALE`.
- `getGrowthStage` picks the `.riv` stage.
- `planXpGain` gives the animation segments that `CharacterXPBar` plays (`onLevelUp` hook).

`src/hooks/useCharacterLevel.ts` is a thin client state hook over it and saves nothing.
