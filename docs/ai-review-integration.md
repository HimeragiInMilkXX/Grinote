# AI review (aiScore)

Since MVP 4.0, `src/lib/rewards/ai-review.ts` is no longer a placeholder. The score comes from the **task report analysis** of the journey system (`docs/journey-system.md`): the AI rates the user's reflections for effort (relevance 30 + attempt 40 + seriousness 30 = 0..100), the user confirms it, and `awardTaskCompletion` reads it from `task_journals`.

## Contract

`getAiReviewScore({ supabase, projectId, recordId })` returns `AiReviewResult`:

```ts
interface AiReviewResult {
  score: number | null;        // 0..REWARD_CONFIG.aiScoreMax, or null = no review
  source: "none" | "ai";
  model?: string;              // model that analysed the report
  evidenceSummary?: string;    // the analysis conclusion, max 200 chars (no raw report or evidence)
  reviewedAt?: string;         // ISO timestamp of the analysis
  verification?: "self_report" | "evidence";
}
```

- `journalToAiReview` (pure, unit-tested in `ai-review.test.ts`) gives `source: "ai"` only for a journal with `analysis_status = 'analyzed'`, an `ai_score`, and a valid `analysis`. Everything else is `{ score: null, source: "none" }`.
- The result is stored at `reward_breakdown.inputs.ai`. The formula version stays `"1.0"`; past records are never recomputed. Records before 4.0 keep `source: "none"`.

## Rules (still in force)

- **A score not produced by a real review never looks verified.** When the analysis fails, the user can claim XP without AI: `aiScore = null` (×1.00), shown as AI分析なし.
- **Completion never gets stuck on the AI.**
  - The analysis runs before confirmation, on the report page.
  - It uses a 120 s timeout and one retry for bad output, and it never throws (`runJourneyAnalysis`).
  - After a failure the no-AI claim is available.
- The score is clamped in code. The model never gives the total; `normalizeAnalysis` sums the clamped parts.
- It runs at `temperature: 0` with a fixed rubric prompt kept with the code (`src/lib/journey/prompt.ts`).
- The RPC `complete_task_with_reward` refuses a breakdown whose `inputs.ai.score` differs from the journal's `ai_score`.

## UI

- `task-reward-breakdown.tsx` shows `AIレビュー スコア n / 100（自己申告・AIによる評価）` with the conclusion.
- `JourneyAnalysisView` shows the rubric parts with their reasons and a note that the score is an AI estimate from self-reported reflections.

## Privacy

The analysis sends the reflections, the task, the project goal and the last 5 AI summaries to Gemini (Google) by default when `GEMINI_API_KEY` is set, or to `AI_BASE_URL` (local Ollama) when it is not or Gemini fails. Check the university's latest rules before using an external provider; the original text is sent during processing even if only the summary is shown later.
