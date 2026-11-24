# Replacing the AI review placeholder

`src/lib/rewards/ai-review.ts` currently returns `{ score: null, source: "none" }` for every task. This keeps the AI factor at exactly 1, and the breakdown shows 「AIレビューは準備中です（ボーナスなし）」. Follow these steps once the real AI review exists. Read `docs/reward-engine.md` first.

## 1. Keep the contract

`getAiReviewScore(ctx)` must keep returning `AiReviewResult`:

```ts
interface AiReviewResult {
  score: number | null;       // 0..REWARD_CONFIG.aiScoreMax, or null = no review
  source: "none" | "ai";      // add "manual" etc. only together with the UI change in step 5
}
```

You can extend it with optional fields. They get stored in the snapshot as-is:

```ts
  model?: string;             // e.g. the model id from src/lib/ai/models.ts
  evidenceSummary?: string;   // short text shown to the user (no raw material contents)
  reviewedAt?: string;        // ISO timestamp
```

`ctx` currently holds `{ projectId, recordId, nodeId }`. Load anything else you need inside the function: the node's `task_name` and `description`, materials linked through `material_nodes`, memos (`materials.content`), and the duration. Keep `ai-review.ts` free of `"use server"`. It's called from `src/lib/rewards/award-task.ts`, which already runs on the server.

## 2. Hard rules (spec rule 5)

- **A score that wasn't produced by a real review must never look verified.** Simulated, dummy and fallback values must return `score: null` (or `source` stays `"none"`), so the AI factor stays 1.
- Clamp and validate. The engine already clamps to `0..aiScoreMax` and rejects `NaN` and `Infinity`, but return `null` instead of throwing when the model output is unusable.
- **Never block or fail the completion.** Wrap the call in a timeout (e.g. 10–15 s) and in `try/catch`, and fall back to `{ score: null, source: "none" }`. Completing a task must work when Ollama or the provider is down.
- The review must be deterministic enough to be fair. Use `temperature: 0` and a fixed rubric prompt, and keep the prompt with the code.

## 3. Where it runs

`awardTaskCompletion` calls `getAiReviewScore` **once**, before the XP retry loop. The score doesn't depend on XP, so an `xp_conflict` retry doesn't call the AI again. If the review is slow, you can instead:

- (a) keep it inline with a short timeout, or
- (b) later, add a separate "review bonus" record that is awarded after completion.

Option (b) needs its own RPC, its own idempotency key, and a new formula version. Don't recompute the original record.

## 4. Snapshot and versioning

- The result is stored at `reward_breakdown.inputs.ai`. Nothing else is needed for the history to keep the score.
- Plugging in a real score **doesn't** change the formula, so `REWARD_FORMULA_VERSION` can stay `"1.0"`. Bump it only if the way the score enters the formula changes (e.g. a different curve).
- Past records are never recomputed (spec rule 8). Old completions keep their `ai.source = "none"`.

## 5. UI

In `src/components/project/task-complete/task-reward-breakdown.tsx`, the `ai` row already shows `AIレビュー スコア {score} / {aiScoreMax}` when `source === "ai"`.

- Show `evidenceSummary` under that row if you add it.
- Add a short label that the score is AI-generated, and a link to explain it if needed.
- If you add new `source` values, give each one an honest label (e.g. 手動評価). Never show a simulated value as an AI review.

## 6. Privacy and the university's rules

The review sends task names, memos and material text to the AI provider (`AI_BASE_URL`). The default is local Ollama. A hosted provider means data leaves the machine.

- Send only what the rubric needs, and avoid personal data where you can.
- Don't send uploaded files unless that's intended. `read_material` doesn't read them either.
- Before turning on an external provider, check the university's latest rules on external AI processing and on sending student data. Even if you only store a summary, the original text is sent while it's processed.

## 7. Tests to add

- `ai-review.test.ts`: maps model output to a score, clamps out-of-range values, returns `null` on unparseable output and on timeout, and never throws.
- `engine.test.ts` already covers `aiScore` 0 / null / 100 / over the max.
- An integration check: complete a task with the provider stopped. It must still complete and show 準備中.
- Update the docs: this file, `docs/reward-engine.md` (the `aiScore` source row), and `CLAUDE.md`.
