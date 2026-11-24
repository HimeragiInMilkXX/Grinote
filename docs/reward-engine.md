# Reward Engine v1.0 (task XP)

Implements *Grinote Reward Engine — Implementation Specification v1.0*. Each completed task earns its own XP from the formula below. XP is awarded **once, on the server, at the moment the task is completed**. The full calculation is stored on the record, and the task_complete page shows it.

## Files

| File | Role |
|---|---|
| `src/lib/rewards/config.ts` | Constants you can change (formula, timezone, level scale, completion resources) |
| `src/lib/rewards/engine.ts` | `calculateTaskReward(input, config?)`: the pure formula, with validation |
| `src/lib/rewards/streaks.ts` | Day keys in the reward timezone, `computeProjectStreak`, `computeTaskStreak` |
| `src/lib/rewards/ai-review.ts` | `getAiReviewScore()`: **placeholder** that returns `null` (see `docs/ai-review-integration.md`) |
| `src/lib/rewards/breakdown.ts` | `TaskRewardBreakdown` snapshot type, `buildRewardBreakdown`, interval/ms → minutes |
| `src/lib/rewards/award-task.ts` | Server only: gathers inputs from the DB, computes, calls the RPC, retries on `xp_conflict` |
| `src/lib/character/level.ts` | Level curve, level state, growth stage, `planXpGain` (animation segments) |
| `supabase/migrations/20261123000001_reward_engine.sql` | Columns, `complete_task_with_reward`, `add_character_xp`, one-off XP rescale |
| `src/components/project/task-complete/task-reward-breakdown.tsx` | The 獲得XPの内訳 card |

Tests: `src/lib/rewards/*.test.ts` and `src/lib/character/level.test.ts`. They include every acceptance row from the spec.

## Configuration (`REWARD_CONFIG`)

The names are more descriptive than the spec's. This table maps each one back to the spec.

| Config key | Spec name | Default | Meaning |
|---|---|---:|---|
| `baseXp` | `BaseXp` | 50 | Base XP per completion |
| `timeBonusWeight` | `TimeMultipler` | 0.4 | Weight of the time ratio |
| `timeRatioCap` | `TimeMaxBonus` | 1.5 | Cap on the estimated/actual ratio |
| `projectStreakMaxBonus` | `ProjectStreakMultipler` | 0.1 | Max project-streak bonus (+10%) |
| `projectStreakDaysForMaxBonus` | `ProjectStreakMaxRewardedDays` | 7 | Days needed for the max bonus |
| `taskStreakMaxBonus` | `TaskStreakMultipler` | 0.05 | Max same-day task-streak bonus (+5%) |
| `taskStreakTasksForMaxBonus` | `TaskStreakMaxRewardedTask` | 3 | Tasks needed for the max bonus |
| `aiScoreMaxBonus` | `AiMultipler` | 0.15 | Max AI-score bonus (+15%) |
| `aiScoreMax` | `AiMaxScore` | 100 | Highest AI score |
| `growthStageMaxBonus` | `CharacterLvMultipler` | 0.5 | Max growth-stage bonus (+50%) |

Other settings in the same file:

- `REWARD_FORMULA_VERSION` (`"1.0"`): stored on every reward. Bump it when the formula changes. Changing only a constant doesn't need a bump, because the config values are snapshotted too.
- `REWARD_DAY_TIMEZONE` (`"Asia/Tokyo"`): decides what "today" is for streaks.
- `PROJECT_STREAK_LOOKBACK_DAYS` (400): how far back the project streak is checked.
- `LEVEL_XP_REQUIREMENT_SCALE` (5): see *Level curve* below.
- `TASK_COMPLETION_RESOURCES` (`{1:1,2:1,3:1}`): resources given on each completion.

Changing a value affects **future** completions only. Past rewards are never recomputed (spec rule 8).

## Formula

```text
clamp(x, lo, hi) = min(max(x, lo), hi)

TimeFactor          = estimated > 0 and actual > 0
                      ? 1 + timeBonusWeight * min(estimated / actual, timeRatioCap)
                      : 1
ProjectStreakFactor = 1 + projectStreakMaxBonus * clamp(projectStreak, 0, D) / D   (D = projectStreakDaysForMaxBonus)
TaskStreakFactor    = 1 + taskStreakMaxBonus    * clamp(taskStreak, 0, T) / T      (T = taskStreakTasksForMaxBonus)
AiFactor            = 1 + aiScoreMaxBonus       * clamp(aiScore ?? 0, 0, aiScoreMax) / aiScoreMax
CharacterFactor     = 1 + growthStageMaxBonus   * clamp(growthStage, 0, maxStage) / maxStage

RawXp     = baseXp * TimeFactor * ProjectStreakFactor * TaskStreakFactor * AiFactor * CharacterFactor
AwardedXp = round(RawXp)   // once, at the very end
```

The maximum is `round(50 × 1.60 × 1.10 × 1.05 × 1.15 × 1.50) = 159`. The engine rejects non-finite values, negative times, `maxStage <= 0`, and streaks that aren't nonnegative integers (`RewardInputError`).

## Where each input comes from (`award-task.ts`)

| Input | Source |
|---|---|
| `estimatedTime` | `nodes.time_limit` (interval) in minutes. The default `00:00:00` means no estimate, so the factor is 1 |
| `actualTime` | Tracked `duration` (ms) in minutes. 0 means the factor is 1 |
| `projectStreak` | `computeProjectStreak` over completed `records` days (see rules) |
| `taskStreak` | `computeTaskStreak` over today's completed/abandoned `records` |
| `aiScore` | `getAiReviewScore()`: currently always `null`, so the factor is 1 |
| `growthStage` / `maxStage` | `getGrowthStage(level before this reward, growth_step)`: the index of the growth_step key. The default characters have keys 1/5/10/25/45/50, so stages run 0..5 and `maxStage` is 5 |

Everything except the tracked duration is read from the DB, never from the client.

### Streak rules (provisional product rules)

The spec leaves these open. The rule ids are stored in the snapshot (`rules`), so a later rule change can be told apart in history.

- **Project streak (`workday-aware-v1`)**: today always counts (this completion), giving 1. Then it walks back from yesterday, one day at a time, in `REWARD_DAY_TIMEZONE`:
  - a day with at least one completed task adds 1
  - a **work day** (`projects.work_days`) with no completion ends the streak
  - a non-work day with no completion is skipped, so it neither adds nor breaks
  - empty `work_days` means every day is a work day
  - the walk stops at the project's creation day

  The result is saved to `projects.streak`.
- **Task streak (`today-earlier-completions-abandon-resets-v1`)**: counts the tasks completed **earlier today** in this project (the current task isn't included), newest first. It stops at the first abandoned task. So the first task of the day is 0, and the 4th task in a row gets the max bonus.

## Execution flow (atomic and idempotent)

1. `onair-timer.tsx` calls the `completeTask(record_id, project_id, duration)` server action.
2. `awardTaskCompletion` reads the record. If it's already `completed`, it returns without awarding anything. Otherwise it reads the project's XP, works out the level and growth stage **before** the award, computes the streaks and the reward, and runs `planXpGain` to get the new level.
3. The RPC `complete_task_with_reward` runs in one transaction (security invoker, so RLS applies):
   1. It locks the record. An already completed record returns `{already_completed: true}`, which makes retries safe.
   2. It locks the project. It raises `xp_conflict` if `character_xp` is no longer the XP the reward was computed from. The app then recomputes, up to 3 attempts. This keeps "stage read before increment" true even when someone feeds the character at the same time.
   3. It writes the record (status, duration, `xp_change`, `reward_breakdown`, `formula_version`, `resource_gained`) and the node progress (loop repetitions use DB values). It adds the XP, sets `character_level` and `streak`, and adds the resources.
4. Redirect to `task_complete?recordId=…`. That page **doesn't** write any XP. It animates `before → after` from the snapshot and calls `markRewardShown`, which sets `reward_redeemed = true`, meaning "animation shown". On a revisit it shows the final state and the breakdown without animating.

Feeding resources (`resources-panel.tsx`) uses `addCharacterXp` → RPC `add_character_xp`, with the same `xp_conflict` check. The level is always derived on the server from the total XP.

## Snapshot (`records.reward_breakdown`, `TaskRewardBreakdown`)

```jsonc
{
  "formulaVersion": "1.0",
  "config": { "baseXp": 50, ... },                 // values used
  "inputs": { "estimatedMinutes": 30, "actualMinutes": 18.2, "projectStreak": 3, "taskStreak": 1,
              "ai": { "score": null, "source": "none" }, "growthStage": 1, "maxStage": 5 },
  "factors": { "timeFactor": 1.6, "projectStreakFactor": 1.0428, ... },
  "rawXp": 93.95, "awardedXp": 94,
  "before": { "totalXp": 1200, "level": 5 }, "after": { "totalXp": 1294, "level": 5 },
  "levelXpScale": 5,
  "rules": { "projectStreak": "workday-aware-v1", "taskStreak": "...", "timeZone": "Asia/Tokyo" },
  "computedAt": "2026-11-23T10:00:00.000Z"
}
```

Use the stored `awardedXp` / `xp_change` for displays and the future journey timeline. Never recompute it. Records from before v1.0 have no breakdown, and the page shows a "旧方式" note for them.

## Level curve and growth stages (`src/lib/character/level.ts`)

- `characters.growth_step` maps a starting level to the XP needed per level-up from that level on. For example, `{1: 50, 5: 100}` means Lv1–4 need 50 each and Lv5 onward need 100. Every requirement is multiplied by `LEVEL_XP_REQUIREMENT_SCALE`.
- **Total XP is the source of truth.** `character_level` is a cached value that the server writes from `getLevelState(totalXp)`. The client never saves a level.
- `planXpGain(prevTotal, gained, curve)` returns `{before, after, segments[{level, from, to, levelUp}], levelsGained}`. `CharacterXPBar` plays the segments with GSAP and calls `onLevelUp(level)` for each level-up. That's the hook for future level-up or evolution animations. A growth-stage change is `getGrowthStage(before.level).stage !== getGrowthStage(after.level).stage`.
- **Why the scale:** a task now gives about 50–160 XP instead of a fixed 10. Without the scale, early levels (50 XP) would go up on almost every task. With a scale of 5, early levels need 250 XP, which is about 3–4 tasks.
- **One-off migration:** `projects.character_xp *= 5` (in the migration), so every existing project keeps its level. If you change the scale later, rescale `character_xp` the same way, or existing levels will shift. Resource XP (`resources.xp`) is **not** scaled, so feeding is relatively weaker now. Tune `resources.xp` if needed.

Balancing level/XP pacing is a separate task (spec rule 10). The growth-stage bonus feeds back into growth on purpose.

## Changing things

- **Tune a value:** edit `REWARD_CONFIG` and run `npm test`. The acceptance tests use the defaults, so update them if you change a default on purpose.
- **Change the formula:** edit `engine.ts`, bump `REWARD_FORMULA_VERSION`, update this doc and the tests.
- **Change a streak rule:** edit `streaks.ts`, change the rule id constant, and update this doc.
- **Add the real AI review:** follow `docs/ai-review-integration.md`.
