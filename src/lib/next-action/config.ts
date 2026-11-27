import { REWARD_DAY_TIMEZONE } from "@/lib/rewards/config";

/**
 * AI suggested next action (MVP 5.5). See docs/next-action.md.
 * A draft allows the first generation plus NEXT_ACTION_MAX_REVISIONS regenerations/revisions;
 * after that the user must save (as is, or edited) or reject it.
 */
export const NEXT_ACTION_MAX_REVISIONS = 3;
export const NEXT_ACTION_MAX_GENERATIONS = 1 + NEXT_ACTION_MAX_REVISIONS;

/** Same day boundaries as streaks, rewards and the calendar. */
export const NEXT_ACTION_TIMEZONE = REWARD_DAY_TIMEZONE;

/** Text limits (characters) for what the model writes and what the user types. */
export const NEXT_ACTION_TEXT_LIMITS = {
    reason: 200,
    message: 300,
    feedback: 300,
} as const;

/** How many journey summaries the model reads. */
export const NEXT_ACTION_HISTORY_LIMIT = 5;

/** Plan types. progress = one task; practice_progress = one loop (practice) task + one task. */
export const PLAN_KINDS = [ "progress", "practice_progress" ] as const;
export type PlanKind = typeof PLAN_KINDS[ number ];

export const PLAN_KIND_LABELS: Record<PlanKind, string> = {
    progress: "進捗タスク",
    practice_progress: "練習＋進捗",
};

/** What the user chose after a task completion. */
export const PLAN_INTENTS = [ "next_work_day", "continue_now", "unsure" ] as const;
export type PlanIntent = typeof PLAN_INTENTS[ number ];

export const PLAN_INTENT_LABELS: Record<PlanIntent, string> = {
    next_work_day: "次の作業日にやる",
    continue_now: "まだ続けて新しいタスクを始める",
    unsure: "わからない",
};

export const PLAN_ORIGINS = [ "task_completed", "tree_saved", "manual" ] as const;
export type PlanOrigin = typeof PLAN_ORIGINS[ number ];

export const PLAN_STATUSES = [ "draft", "saved", "rejected", "replaced", "expired" ] as const;
export type PlanStatus = typeof PLAN_STATUSES[ number ];
