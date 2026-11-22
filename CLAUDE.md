# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Grinote" MVP: a goal-tracking app. Each project has a goal tree (a React Flow graph of tasks), materials (files and memos), a timed "on air" work session, and a growth character (Rive animations) that levels up as tasks are completed. An AI assistant drawer can read the project and propose additions to the goal tree. The UI text is mostly Japanese.

## Commands

- `npm run dev`: dev server on http://localhost:3000
- `npm run build` / `npm run start`
- `npm test`: Vitest unit tests (`src/**/*.test.ts`, node env, `@/` alias via `vitest.config.ts`). No lint script. Use `npm run build` (or `npx tsc --noEmit`) to type-check.
- `npm run eval:tree`: slow model eval (`scripts/eval-tree-agent.eval.ts`, `vitest.eval.config.ts`) that runs scripted tree-edit requests against local Ollama models with a fixture graph. `EVAL_MODELS=a,b` limits models, `EVAL_OUT=path.json` writes the report. Not part of `npm test`.
- `.npmrc` sets `legacy-peer-deps=true` because `use-undoable` declares only React 17/18 peers. Keep it.

Env vars (in `.env*`, which is gitignored): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `AI_BASE_URL` (default `http://localhost:11434/v1`, Ollama), `AI_API_KEY`, `TAVILY_API_KEY` (web_search tool).

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
- Tables in use: `projects`, `nodes`, `materials`, `material_nodes`, `records`, `resources`, `project_resources`, `profile`. Storage bucket: `materials_media`. There are no migrations or a schema in the repo (schema changes are applied through the Supabase MCP).

### Materials
- `materials` has `is_favourite` and `pinned_at` (null = not pinned; pins are ordered by it). The pin limit is `MATERIAL_PIN_LIMIT` in `src/lib/materials/config.ts`, enforced in `setMaterialPinned`. `getProjectMaterials` excludes pinned rows; `getPinnedMaterials` lists them above the table regardless of search/filter.
- `material_nodes(material_id, node_id, project_id)` links materials to tree nodes. Both FKs are `ON DELETE CASCADE`, so deleting a node (via `saveGraphToNodes`) or a material removes its links; no app code does this. Links are written straight to the DB (`setMaterialNodeLinks` / `setNodeMaterialLinks`), not through the tree save, and only saved nodes can be linked.
- `MaterialViewer` (`components/material/material-viewer.tsx`) renders any material with `MaterialViewerHeader` (favourite/pin/link) and a `MemoSection` (the `content` column) under every non-memo type. It's shared by the material tabs and `LinkedMaterialsList` (sheet viewer used in the node panel and on-air).
- Memo images go to `materials/{id}/memo/`; `clearUnusedImages` only cleans that folder, never the material's main file. `RichTextEditor` needs `material_id`.
- Unsaved memos: `RichTextEditor`'s `onChange` fires on user edits and inserted AI drafts (loading `content` uses `emitUpdate: false`). `useUnsavedMemo` keeps dirty material ids in `memoUnsavedAtom`; the memo editors show a notice, the tab trigger shows a red dot, and closing a tab, closing the material sheet, leaving via `project-navigation.tsx`, or reloading asks first. Material tab panels use `keepMounted` so switching tabs doesn't drop edits.
- The root node can't hold materials: pickers hide it, the link server actions and `normalizeMaterialOps` (`rootIds`) reject it, and the `material_nodes` RLS `with check` refuses root nodes.
- Bulk create: dropping files on the list sets `materialCreateQueueAtom`; `create/material-create-panel.tsx` queues them with `detectMaterialType` (`src/lib/materials/detect-type.ts`) and each item must be confirmed before 全て保存. List reloads are driven by `materialListVersionAtom`.

### Route conventions
Each route folder keeps its own `serverActions.ts` (`"use server"`, Supabase access) and `clientActions.ts` (client-only helpers) next to `page.tsx`. Shared domain types in `src/types/*.ts` (e.g. `Project`, `Character`) are mostly **ambient globals**, not exported, so they're used without imports.

Main routes: `(auth)/login|signup`, `dashboard` (project list), `project/new/{goal,details,character,complete}` (a wizard whose state lives in `new_project_atom`), and `project/[projectId]/{dashboard,tree,materials,onair,task_complete,character}`. `project/[projectId]/layout.tsx` loads the project, then mounts the navigation, the tutorial panel, and the assistant (`ChatProvider` + `AssistantDrawer`).

### Goal tree
- Client: `src/components/flow/` (`flow-client.tsx`, `task-node.tsx`). Nodes are `TaskNodeType = Node<{label, task: Task}, 'taskNode'>` (`src/types/flow.ts`). Auto-layout uses dagre (`tree/clientActions.ts`).
- Persistence: `tree/serverActions.ts` `saveGraphToNodes` turns the React Flow JSON into flat `nodes` rows (`pos_x/pos_y`, `parent_node_id` taken from edges, `time_limit` stored as a Postgres interval via `durationObjectToInterval`/`intervalToDurationObject` in `src/utils/utils.ts`), then upserts and deletes rows to match. Edges aren't stored, only `parent_node_id`.
- Node ids: `nodes.id` is a global uuid PK, so always create ids with `newNodeId(taken)` from `src/lib/tree/ids.ts` (works without `crypto.randomUUID` over plain http), never `crypto.randomUUID()` directly. JSON import gives every pasted node a fresh id. `saveGraphToNodes` sanitizes ids (`sanitizeGraphIds`), upserts only rows already in this project, plain-inserts new rows (a row of another project is remapped, never overwritten), and returns `{ idMap }` that `flow-client.tsx` applies to the canvas.
- Domain rules: exactly one `isRoot` node, and an action parent can't start until all its direct children are complete.

### AI assistant
- `src/app/api/chat/route.ts`: Vercel AI SDK v7 `streamText` against an **OpenAI-compatible provider** (`src/lib/ai/provider.ts`, Ollama by default). Allowed models are listed in `src/lib/ai/models.ts`. Each request carries `project_id`, which goes into `generateSystemPrompt` (`src/lib/ai/system-prompt.ts`). It stops after 8 steps.
- Tools are in `src/tools/` and registered in `src/tools/index.ts`, which also exports the `ChatUIMessage` type and the per-tool part types. To add a tool: create it with `tool()` + zod, add it to `baseTools`, export a `tool-<name>` part type, and add a renderer in `src/components/assistant/parts/`.
- `ask_user` and `propose_goal_tree` are human-in-the-loop. `propose_goal_tree` drafts full CRUD on the tree as four op lists (`add` / `update` / `move` / `delete`). "Break a connection" is a `move` (single-parent tree, no orphans allowed). Its `execute` loads the saved graph, runs `normalizeOps` + `applyTreeChanges` from `src/lib/tree/tree-changes.ts`, throws on rule violations (the model sees the error and retries), and returns normalized ops + a diff. `toModelOutput` sends the model a short text summary only.
- Tree rules (enforced in `tree-changes.ts`, unit-tested): the `isRoot` node is never edited, deleted, or given a parent, and every node must descend from it; `isCompleted` nodes are never edited, moved, deleted, or connected to; loops with `repetitions_completed > 0` are "protected" and change only if the user ticks them on the review card (`allowedProtectedIds`, `withoutOpsFor`). Deleting a node moves its children up to its parent unless they're moved or deleted too. Deleting also cascades the node's `records`.
- Review flow: `components/assistant/proposal-question-card.tsx` (counts, protected-loop checkboxes, warnings) → `graph_edit_request_atom` holds `{ops, allowedProtectedIds, warnings}` → `flow-client.tsx` re-applies the ops to the *current* canvas and shows `flow/generated/requested-update-confirmation-dialog.tsx` (preview via `buildPreviewGraph`, colored per change, tooltips with before→after). Other atoms: `graph_edit_reviewed_proposal_atom`, `tree_requires_save_action_atom` (used by `components/navigation/project-navigation.tsx`). Nothing is saved until the tree is saved.
- `saveGraphToNodes` is the server-side safety net: root/completed rows are never deleted and only their position is written, and `isRoot`/`isCompleted`/`repetitions_completed` always come from the DB (a stale canvas can't undo progress). AI add keys always become fresh ids in `normalizeOps` (a model-sent UUID is never kept), and `flow-client.tsx` re-keys an accepted draft with `rekeyAddOps` if a key collides with the current canvas; `buildPreviewGraph` never returns duplicate node/edge ids.
- When you change tool schemas, keep the system prompt and the zod `.describe()` text consistent. They're tuned for small local models (Gemma/Qwen).
- Material tools: `list_materials` / `read_material` (metadata + memo as plain text; uploaded file contents are not read), `propose_materials` (draft of new external links, link/unlink, suggestions; validated by `normalizeMaterialOps` in `src/lib/materials/proposal.ts`; the inline card in `parts/propose-materials-part.tsx` writes ticked items immediately via `applyMaterialProposal`), and `draft_memo` (Markdown → HTML via `src/lib/materials/markdown.ts`; the card sets `memoDraftRequestAtom`, and `useMemoDraft` writes it into the editor unsaved). Reviewed card ids live in `materialProposalReviewedAtom`.
- Fallbacks: the route wraps the run in `createUIMessageStream` and writes the `finish` chunk itself with `metadata.finishReason` (and `autoRetried`). If a turn returns only reasoning (no text, no tool call), it silently re-runs once with a hidden nudge. Errors are logged and mapped to Japanese text by `describeChatError` (`src/lib/ai/errors.ts`). On the client, `getReplyIssue` (`src/lib/ai/reply-status.ts`) checks the last turn for error / stopped / interrupted (no `finishReason`) / empty / length / step-limit. `useStallDetector` flags a reply with no new chunk for 45 s. `components/assistant/reply-fallback.tsx` shows the card with 再試行 / 続きを生成 / 続ける / 停止して再試行.
- The client sends `context` (`assistantPageContextAtom`: open material / on-air node) with every chat request; `parsePageContext` validates it and `generateSystemPrompt` adds it. The route stops after 8 steps.

### Assets
Character Rive files: `public/character/rive/<characterId>/<level>.riv` (levels 1/5/10/25/45/50), with thumbnails in `public/character/thumbnail/`. Level/XP logic is in `src/hooks/useCharacterLevel.ts` and `useLevel.tsx`.
