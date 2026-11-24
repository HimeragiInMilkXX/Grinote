# Journey system (MVP 4.0)

A finished task no longer gives XP right away. The user first writes a **task report**, the AI analyses it and scores the user's **effort**, the user **confirms** the summary, and only then is XP awarded. Every confirmed report goes on the project's **journey** timeline, which the chat assistant can also read.

Read `docs/reward-engine.md` for the XP formula. The AI score is its `aiScore` input.

## Flow

```
on-air 完成 ──► finishTask ──► records.status = 'reviewing'   (timer stopped, ended_at set, journal snapshot, no XP)
                                  │
                task_report page  ▼
   reflections (3, all required) ─► analyzeReport ─► journal 'analyzing' ─► runJourneyAnalysis (LLM)
                                  │        ├─ clarify   → AI questions (max 2 rounds; これ以上書けない = skip)
                                  │        ├─ analysis  → journal 'analyzed' (score, summary, next actions)
                                  │        └─ failure   → journal 'failed' (再試行 or AIなしで受け取る)
                                  ▼
   確認して経験値を受け取る ─► confirmReport ─► awardTaskCompletion ─► RPC complete_task_with_reward
                                  │   (record 'completed', XP/level/streak/resources, journal 'confirmed', in one transaction)
                                  ▼
                           task_complete page (XP animation)  ─►  journey timeline
```

- **作業に戻る** (on the report page, until confirmed): the record goes back to `paused` with its time kept. The reflections, the analysis and the run counter stay. After finishing again the user can confirm that analysis, or re-analyse with the new time if runs are left.
- **Re-analysis**: 修正して再分析. At most `MAX_ANALYSIS_RUNS` (3) analyses per record in total, also across 作業に戻る, so the score can't be re-rolled forever. Once a record has an analysis it always keeps one: a failed or clarifying re-analysis keeps the previous one. So the user can never be left with neither an analysis nor a run.
- **Analysed text**: the analysis stores the reflections it was made from (`analysis.reflection`). `confirmReport` writes them back to the reflection columns, so the journey always shows the text the score was computed from.
- **Running**: while the model runs the journal is `analyzing`, and confirming, drafts and 作業に戻る are refused. A run interrupted for more than 6 minutes (`ANALYZING_STALE_MS`; the run itself times out after about 4) is recovered to `analyzed`/`failed` by the next action (`recoverStaleJournal`).
- **No-AI claim**: only after a failed analysis (`analysis_status = 'failed'`), and only with valid stored reflections. XP uses `aiScore = null` (×1.00). The journey shows it as AI分析なし. A score is never simulated.
- A pending report blocks starting another task, editing the tree (also on the server in `saveGraphToNodes`), changing settings, and reset/delete. It counts as an active task, also in the DB (`projects_guard_settings`, `reset_project_progress`, and the unique index `records_one_open_per_project`). The on-air page and the dashboard link to it.
- Streak days use `ended_at` (when 完成 was pressed), not the confirmation time. `completed_at` is set to `ended_at` by the RPC, and the dashboard day cards count by `completed_at`.
- The task snapshot (name, description, estimate) is taken at 完成 (`createJournalSnapshot`), and the reward uses its `estimated_minutes`.

## Files

| File | What it does |
|---|---|
| `supabase/migrations/20261124000001_journey_system.sql` | The `reviewing` status, `records.ended_at`, `task_journals` + RLS + guard trigger, the updated RPCs |
| `src/lib/journey/reflection.ts` | The 3 questions (Japanese labels and hints), `validateReflection`, `validateClarificationAnswers` |
| `src/lib/journey/analysis.ts` | The model output zod schema, `normalizeAnalysis` (clamps the rubric, sums the score in code, sets the verification), `JourneyAnalysis`, `parseLooseJson` |
| `src/lib/journey/prompt.ts` | The fixed rubric system prompt and `buildAnalysisPrompt` (reflections wrapped in `<user_…>` tags, last 5 AI summaries as history) |
| `src/lib/journey/analyze.ts` | `runJourneyAnalysis`: `generateText` + `Output.object`, `temperature: 0`, 120 s timeout, 1 retry, never throws |
| `src/lib/journey/journal.ts` | `task_journals` row type, `JournalView`, clarification helpers, limits, `recoveredStatus` |
| `src/lib/journey/journal-db.ts` | Server-only journal queries: `loadJournal`, `createJournalSnapshot`, `updateJournal` (optimistic on `updated_at`), `recoverStaleJournal` |
| `src/lib/journey/history.ts` | `loadJourneyEntries`, `computeJourneyStats`, `toHistorySummary` (evidence-free) |
| `src/lib/rewards/ai-review.ts` | `getAiReviewScore` reads the journal. `journalToAiReview` maps it to the reward snapshot (`inputs.ai`) |
| `src/app/project/[projectId]/task_report/` | The report page and server actions (`getReport`, `saveReflectionDraft`, `analyzeReport`, `confirmReport`, `resumeWork`) |
| `src/app/project/[projectId]/journey/` | The journey page (`getJourney`) |
| `src/components/project/task-report/task-report-flow.tsx` | The report UI (method choice, reflections, clarification, result, failure) |
| `src/components/project/journey/` | Timeline, entry (collapsible), stats, and the shared `JourneyAnalysisView` |
| `src/tools/list_journey.ts`, `read_journey_entry.ts` | Assistant tools (read-only, no evidence) |
| `scripts/eval-journey.eval.ts` | `npm run eval:journey`: rubric cases against local models (reported, not asserted) |

## Data model: `task_journals` (1:1 with `records`)

- `record_id` is the PK and FK to `records`, on delete cascade. So deleting a node, its records, a reset, or a project delete also removes its journals.
- A task snapshot (`task_name`, `task_description`, `estimated_minutes`) is taken at 完成, when `finishTask` creates the journal. Entries read on their own, and the estimate is the reward input.
- `reflection_learned / reflection_difficult / reflection_next`.
- `clarifications` jsonb: `[{ round, question, answer, skipped }]`. Pending questions are the latest round's entries without an answer while the status is `needs_clarification`.
- `evidence` jsonb `[]` and `verification` (`self_report` | `evidence`) are **reserved** for the evidence feature.
- `analysis` jsonb (`JourneyAnalysis`, including the reflections it was based on), `ai_score` (0..100), `model`, `analysis_status` (`draft | analyzing | needs_clarification | analyzed | failed | confirmed | confirmed_without_ai`), `analysis_runs`, `clarification_rounds`, `analyzed_at`, `confirmed_at`.
- The `task_journals_insert_guard` trigger: a journal can only be inserted for a `reviewing` record of the same user/project/node, and always starts as an empty draft.
- The `task_journals_guard` trigger:
  - a confirmed journal is frozen (`journal_locked`)
  - the identity columns never change
  - it can only become `confirmed` once its record is `completed`, which happens inside `complete_task_with_reward`
- `complete_task_with_reward` now:
  - needs the record to be `reviewing` and its journal to be `analyzed` or `failed` (`journal_required`)
  - checks that `p_breakdown.inputs.ai.score` equals `ai_score` (and is null for `failed`)
  - confirms the journal in the same transaction

## Scoring rubric (effort over results)

The model fills three parts. `normalizeAnalysis` clamps each and **adds them up in code**; the model never gives the total:

| Part | Max | Question |
|---|---|---|
| relevance | 30 | Did the user do things really relevant to the task? |
| attempt | 40 | Did the user genuinely try, even if the task was too hard? (weighted most) |
| seriousness | 30 | Was the task taken seriously, or was the report just for the streak? |

- Calibration rules in the prompt:
  - only what the report shows counts
  - a report claiming more work than the actual time could hold is less credible
  - requests for points count as not serious
  - a solid report is usually 70-85; a few generic words score below 35
  The `eval:journey` cases check these.
- The score enters the formula as `aiScore` (`AiFactor = 1 + 0.15 × score / 100`). The formula version stays 1.0.
- `verification` is set in code: `self_report` unless the journal has evidence.
- Reflections are data inside `<user_…>` tags, and `sanitizeUserText` strips tags that could close them. The prompt tells the model never to follow instructions in them. `npm run eval:journey` has an injection case.
- The model is `JOURNEY_AI_MODEL` (env) or `DEFAULT_MODEL`. Change the prompt and the zod `.describe()` texts together; they are tuned for small local models.

## Privacy

- The reflections, the task name and description, the project goal and the last 5 AI summaries are sent to Gemini (Google) by default when `GEMINI_API_KEY` is set, otherwise (or on a Gemini failure) to `AI_BASE_URL` (local Ollama). With Gemini this data leaves the machine.
- Before switching to an external provider, check the university's latest rules: the original text is sent while it is processed, even though only the summary is shown later.
- The assistant tools return reflections and AI summaries, never evidence.

## Trust model (known limit)

- Like the rest of the reward system, writes run with the user's own Supabase session (there is no service-role key). The RPC cross-check and the guard trigger stop accidental or stale writes.
- A user who calls the API directly could still write their own `ai_score` before confirming.
- Moving the analysis write into a `security definer` RPC, or onto a server with a service key, would close this gap.

---

# Next session: evidence upload and evidence analysis

The schema and UI already hold the slots for evidence: `task_journals.evidence`, `verification`, the disabled 証拠をアップロード card, and 証拠なし on the journey. Steps:

1. **Storage.**
   - Use the existing `materials_media` bucket under `journey/{record_id}/…`, or a new private bucket `journey_evidence`.
   - Add storage RLS like the materials policy: the second folder segment must be a `records.id` whose `user_id = auth.uid()`, and the record must still be `reviewing` for insert and delete.
   - Delete the files in `deleteProject` and in reset (storage isn't cascaded; see how `deleteProject` removes material files first).
2. **Upload UI** (`task-report-flow.tsx`):
   - Enable the card, accept `image/*`, `video/*` and `audio/*` (reuse `detectMaterialType` from `src/lib/materials/detect-type.ts`), and show size limits.
   - Store `{ path, type, name, size, uploadedAt }` items in `task_journals.evidence` through a new server action. Allow it only while the journal is not confirmed; the guard trigger already refuses edits after that.
   - Let "evidence only" pass: relax `validateReflection` to "reflections OR evidence". Keep recommending both.
3. **Analysis.**
   - Images: the OpenAI-compatible API accepts image parts. Use a vision-capable Ollama model (e.g. Gemma 3/4 vision, Qwen2.5-VL) for evidence only, through `JOURNEY_EVIDENCE_MODEL`.
   - Video: sample a few frames server-side (ffmpeg) and send them as images.
   - Audio: transcribe first (Whisper via an OpenAI-compatible endpoint, or `experimental_transcribe` from the AI SDK), then send the transcript as text.
   - Pass the evidence as extra user content in `runJourneyAnalysis`, together with a description of each item. Add an `evidence_summary` field to `modelAnalysisSchema`, and tell the prompt that evidence can confirm or contradict the reflections.
   - `normalizeAnalysis` already sets `verification: "evidence"` when `hasEvidence` is true. Only set it when the evidence was actually analysed, not just uploaded.
4. **Rules to keep.**
   - Evidence is used only for scoring at completion. After that, the assistant and the history prompt read only the AI summary; keep `toHistorySummary` and the tools evidence-free.
   - Never present a guessed evidence check as verified. If evidence analysis fails, fall back to `self_report`.
   - Media sent to an external provider leaves the machine. Check the university's rules first.
5. **Tests.**
   - Unit tests for the evidence validation, the storage path builder, and `normalizeAnalysis` with evidence.
   - An `eval:journey` case with a fixture image.
   - Manual tests: upload → analyse → confirm, a failure while uploading, and a delete before confirming.
