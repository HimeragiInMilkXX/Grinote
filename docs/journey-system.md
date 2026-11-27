# Journey system (MVP 4.0)

A finished task no longer gives XP right away. The user first writes a **task report**, the AI analyses it and scores the user's **effort**, the user **confirms** the summary, and only then is XP awarded. Every confirmed report goes on the project's **journey** timeline, which the chat assistant can also read.

Read `docs/reward-engine.md` for the XP formula. The AI score is its `aiScore` input.

## Flow

```
on-air 完成 ──► finishTask ──► records.status = 'reviewing'   (timer closed, ended_at set, journal snapshot, no XP)
                                  │
                task_report page  ▼
   reflections (3) and/or evidence (≤ 3 files) ─► analyzeReport ─► journal 'analyzing' ─► runJourneyAnalysis (LLM)
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
- `evidence` jsonb (`EvidenceItem[]`, see the evidence section) and `verification` (`self_report` | `evidence`, set from the analysis).
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
- `verification` is set in code: `evidence` only when the model reported on a file it really received, else `self_report`.
- Reflections are data inside `<user_…>` tags, and `sanitizeUserText` strips tags that could close them. The prompt tells the model never to follow instructions in them. `npm run eval:journey` has an injection case.
- The model is `JOURNEY_AI_MODEL` (env) or `DEFAULT_MODEL`. Change the prompt and the zod `.describe()` texts together; they are tuned for small local models.

## Privacy

- The reflections, the task name and description, the project goal and the last 5 AI summaries are sent to Gemini (Google) by default when `GEMINI_API_KEY` is set, otherwise (or on a Gemini failure) to `AI_BASE_URL` (local Ollama). With Gemini this data leaves the machine.
- Before switching to an external provider, check the university's latest rules: the original text is sent while it is processed, even though only the summary is shown later.
- The assistant tools return reflections and AI summaries, never evidence.
- Evidence files (photos, video, audio) are sent to Gemini (Google) for the analysis.

## Trust model (known limit)

- Like the rest of the reward system, writes run with the user's own Supabase session (there is no service-role key). The RPC cross-check and the guard trigger stop accidental or stale writes.
- A user who calls the API directly could still write their own `ai_score` before confirming.
- Moving the analysis write into a `security definer` RPC, or onto a server with a service key, would close this gap.

---

# Evidence upload and evidence analysis (MVP 6.5)

On the report page the user can upload up to 3 photos, videos or audio files (証拠をアップロード). The AI looks at them together with the reflections, with the same rubric and score. It reports what it saw or heard in each file, and the journey shows the media and those reports. The files are only read by the AI while the report is written. After confirmation they are just stored, and the user can delete them from the journey; the AI's analysis of them stays.

## Flow

```
task_report ── uploadEvidence (server action, FormData) ── storage journey_evidence + task_journals.evidence
           ── analyzeReport ── prepareEvidenceParts: storage download → Gemini Files API (uploadFile)
                            └─ runJourneyAnalysis: Gemini gets the file parts + the text prompt
                                 ├─ ok → analysis.evidence (per-file report) + evidenceSummary, verification 'evidence'
                                 └─ Gemini fails before answering → text-only on the usual chain, files 未分析,
                                    verification 'self_report' (evidence-only report → the run fails)
           ── confirmReport (refused while a file uploaded after the analysis isn't analysed)
journey ── deleteJourneyEvidence (allowed after confirm; the DB guard lets only evidence items go)
```

- **A report is either one:** the three reflections, or at least one file. With a file the answers are optional (max length only, `validateReport` / `reportSchema(hasEvidence)`); both are recommended, and the page shows a レポートの充実度 1/2 indicator. The no-AI claim after a failed analysis also accepts evidence-only reports.
- **Limits** (`EVIDENCE_LIMITS` in `src/lib/journey/evidence.ts`, same checks on the client and the server): max `MAX_EVIDENCE` (3) files. Photos JPG/PNG/WebP/HEIC up to 10 MB, video MP4/MOV/WebM/MPEG up to 50 MB, audio MP3/WAV/AAC/OGG/FLAC/AIFF up to 25 MB (3 minutes or less recommended). These are formats Gemini documents; m4a is not accepted. 50 MB is the Supabase free-plan file cap. The bucket has `file_size_limit` 50 MB and the same `allowed_mime_types`.
- **When files can change:** uploads only while the record is `reviewing`, the journal isn't confirmed, `analyzing` or `needs_clarification`, and an analysis run is left. So a new file can always be analysed before confirming. Deleting works any time before confirmation (except while analysing) and on the journey afterwards.
- **Only Gemini looks at media.** The local models go through the OpenAI-compatible API, which has no video or audio input. `getEvidenceModelId()` is `JOURNEY_EVIDENCE_MODEL` or the default Gemini model, or null without `GEMINI_API_KEY`, and then the upload card is disabled with the reason. A file that couldn't be downloaded or uploaded is told to the model as "not given", and it never counts as analysed. `verification = 'evidence'` only when the model returned a non-empty `observed` for a file it really got.
- **Time:** uploads and generation share `RUN_BUDGET_MS` (5 min); `ANALYZING_STALE_MS` is 8 min.
- **Uploads go through a server action.** `next.config.ts` sets `experimental.proxyClientMaxBodySize: '1gb'`, because `src/proxy.ts` buffers request bodies and its 10 MB default truncated larger files.

## Data

- Storage: private bucket `journey_evidence`, path `{user_id}/{project_id}/{record_id}/{evidence_id}.{ext}`, shown through signed URLs (1 h, `withSignedUrls`). Policies: select and delete when the first folder is `auth.uid()`; insert also needs a `reviewing` record of that user and project; no update.
- `task_journals.evidence`: `EvidenceItem[]` (`{ id, path, kind, mime, name, size, uploadedAt }`), at most 3 (guard `journal_evidence_invalid`).
- `analysis.evidence`: `EvidenceReport[]` (`{ id, kind, name, observed, assessment, analyzed }`) and `analysis.evidenceSummary`. These are kept when the files are deleted. The model answers with keys `e1..e3` (`modelEvidenceAnalysisSchema`, used only when files are attached, so local models keep the smaller schema). `normalizeAnalysis` maps the keys to ids.
- Guard `task_journals_guard` (`supabase/migrations/20261130000001_journey_evidence.sql`): a confirmed journal is frozen, except that `evidence` may lose items. Every other column must be equal, and every remaining item must be unchanged. `deleteJourneyEvidence` filters the raw jsonb so the remaining items stay equal.
- Storage isn't cascaded. `deleteProject` and `resetProjectProgress` call `removeProjectEvidence` first. `saveGraphToNodes` removes the files of records of the nodes it deletes, after the delete succeeds.

## Files

| File | What it does |
|---|---|
| `src/lib/journey/evidence.ts` | Limits, formats, `detectEvidenceKind`, `validateEvidenceFile`, paths, `asEvidenceItems`, guidance text (client-safe, unit-tested) |
| `src/lib/journey/evidence-db.ts` | Bucket name, signed URLs, removal by record or project (server-only) |
| `src/lib/journey/evidence-model.ts` | `getEvidenceModelId`, `prepareEvidenceParts` (storage → Gemini Files API) |
| `src/lib/journey/analyze.ts` | Evidence run on Gemini, text-only fallback |
| `src/lib/journey/prompt.ts` | `EVIDENCE_PROMPT_SECTION`, `analysisSystemPrompt`, the evidence list in the prompt, `(not answered)` for empty answers |
| `components/project/evidence/evidence-gallery.tsx` | Media + per-file AI report (+ delete), used by the report page and the journey |
| `components/project/task-report/evidence-upload.tsx` | Drop zone and guidance |
| `components/project/journey/journey-evidence.tsx` | The journey's 証拠 block with delete |

## Rules to keep

- The assistant tools and the history prompt stay evidence-free: no media and no per-file reports (`toHistorySummary`, `list_journey`, `read_journey_entry`).
- Never present a file as checked when the model didn't get it.
- With Gemini the media leave the machine; the upload card says so. Check the university's rules before switching providers.
- Media content is data: the prompt tells the model never to follow text or speech inside the files.
- Known limits: the per-file reports depend on Gemini's perception and can be wrong. Signed URLs expire after an hour on a page left open; reload to see the media again.

## Work timer data (MVP 4.5)

Every record from 4.5 on has `records.timer` (the `TimerState` from `src/lib/timer`). The report, task_complete and journey pages show it through `summarizeStoredTimer` → `TimerSummaryView` (`components/project/timer/timer-summary.tsx`): focus time and sessions, breaks (scheduled / custom) and break time, total (focus + break), pauses (count, time, reasons; not in the total), and the timers used in order (resets marked). Records before 4.5 show 旧バージョン（タイマーの記録なし）.

- `records.duration` is focus time only. It is still what the reward (`actualTime`) and the AI's "Actual focus time" use.
- The analysis prompt also gets a one-line work pattern (`describeWorkPattern`, `src/lib/timer/pattern.ts`): timers, sessions, breaks, pauses. Pause reasons are never sent to the model. The system prompt says breaks and pauses are normal and never low effort.
- `list_journey` / `read_journey_entry` return a `work` object (timers, sessions, breaks, break/pause minutes, resets) and totals `focus_minutes`, `focus_sessions`, `break_minutes`.
- 作業に戻る re-opens the closed timer as a pause starting now (`reopen`), so report-writing time is never counted.
