# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Grinote" MVP: a goal-tracking app. Each project has a goal tree (a React Flow graph of tasks), materials (files and memos), a timed "on air" work session, and a growth character (Rive animations) that levels up as tasks are completed. An AI assistant drawer can read the project and propose additions to the goal tree. The UI text is mostly Japanese.

## Commands

- `npm run dev`: dev server on http://localhost:3000
- `npm run build` / `npm run start`
- No lint script, test runner, or tests are set up. Use `npm run build` (or `npx tsc --noEmit`) to type-check.
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
- Tables in use: `projects`, `nodes`, `materials`, `records`, `resources`, `project_resources`, `profile`. Storage bucket: `materials_media`. There are no migrations or a schema in the repo.

### Route conventions
Each route folder keeps its own `serverActions.ts` (`"use server"`, Supabase access) and `clientActions.ts` (client-only helpers) next to `page.tsx`. Shared domain types in `src/types/*.ts` (e.g. `Project`, `Character`) are mostly **ambient globals**, not exported, so they're used without imports.

Main routes: `(auth)/login|signup`, `dashboard` (project list), `project/new/{goal,details,character,complete}` (a wizard whose state lives in `new_project_atom`), and `project/[projectId]/{dashboard,tree,materials,onair,task_complete,character}`. `project/[projectId]/layout.tsx` loads the project, then mounts the navigation, the tutorial panel, and the assistant (`ChatProvider` + `AssistantDrawer`).

### Goal tree
- Client: `src/components/flow/` (`flow-client.tsx`, `task-node.tsx`). Nodes are `TaskNodeType = Node<{label, task: Task}, 'taskNode'>` (`src/types/flow.ts`). Auto-layout uses dagre (`tree/clientActions.ts`).
- Persistence: `tree/serverActions.ts` `saveGraphToNodes` turns the React Flow JSON into flat `nodes` rows (`pos_x/pos_y`, `parent_node_id` taken from edges, `time_limit` stored as a Postgres interval via `durationObjectToInterval`/`intervalToDurationObject` in `src/utils/utils.ts`), then upserts and deletes rows to match. Edges aren't stored, only `parent_node_id`.
- Domain rules: exactly one `isRoot` node, and an action parent can't start until all its direct children are complete.

### AI assistant
- `src/app/api/chat/route.ts`: Vercel AI SDK v7 `streamText` against an **OpenAI-compatible provider** (`src/lib/ai/provider.ts`, Ollama by default). Allowed models are listed in `src/lib/ai/models.ts`. Each request carries `project_id`, which goes into `generateSystemPrompt` (`src/lib/ai/system-prompt.ts`). It stops after 5 steps.
- Tools are in `src/tools/` and registered in `src/tools/index.ts`, which also exports the `ChatUIMessage` type and the per-tool part types. To add a tool: create it with `tool()` + zod, add it to `baseTools`, export a `tool-<name>` part type, and add a renderer in `src/components/assistant/parts/`.
- `ask_user` and `propose_goal_tree` are human-in-the-loop. `propose_goal_tree` returns a draft only (append-only new nodes with temp keys converted to UUIDs). The user reviews it in the chat, and then the accepted proposal reaches the tree editor through Jotai atoms (`graph_edit_request_atom`, `graph_edit_reviewed_proposal_atom`, `tree_requires_save_action_atom`) used by `components/assistant/chat.tsx`, `components/flow/flow-client.tsx`, and `components/navigation/project-navigation.tsx`. Nothing is saved until the tree is saved.
- When you change tool schemas, keep the system prompt and the zod `.describe()` text consistent. They're tuned for small local models (Gemma/Qwen).

### Assets
Character Rive files: `public/character/rive/<characterId>/<level>.riv` (levels 1/5/10/25/45/50), with thumbnails in `public/character/thumbnail/`. Level/XP logic is in `src/hooks/useCharacterLevel.ts` and `useLevel.tsx`.
