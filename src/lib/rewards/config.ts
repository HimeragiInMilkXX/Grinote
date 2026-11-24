/**
 * Reward engine configuration (Grinote Reward Engine Spec v1.0).
 * Change values here to tune task XP app-wide. See docs/reward-engine.md for the formula
 * and the mapping back to the spec's constant names (BaseXp, TimeMultipler, ...).
 *
 * Changing a value only affects completions from now on: awarded XP is snapshotted on each
 * record and never recomputed. Bump REWARD_FORMULA_VERSION when the formula itself changes.
 */
export const REWARD_CONFIG = {

    /** Spec `BaseXp`: base reward per qualifying task completion. */
    baseXp: 50,

    /** Spec `TimeMultipler`: weight of the time bonus (estimated / actual time). */
    timeBonusWeight: 0.4,
    /** Spec `TimeMaxBonus`: cap on the estimated / actual time ratio. */
    timeRatioCap: 1.5,

    /** Spec `ProjectStreakMultipler`: max bonus for consecutive project days (0.1 = +10%). */
    projectStreakMaxBonus: 0.1,
    /** Spec `ProjectStreakMaxRewardedDays`: streak days needed for the max project bonus. */
    projectStreakDaysForMaxBonus: 7,

    /** Spec `TaskStreakMultipler`: max bonus for consecutive tasks in one day (0.05 = +5%). */
    taskStreakMaxBonus: 0.05,
    /** Spec `TaskStreakMaxRewardedTask`: consecutive tasks needed for the max task bonus. */
    taskStreakTasksForMaxBonus: 3,

    /** Spec `AiMultipler`: max bonus from the AI review score (0.15 = +15%). */
    aiScoreMaxBonus: 0.15,
    /** Spec `AiMaxScore`: highest possible AI review score. */
    aiScoreMax: 100,

    /** Spec `CharacterLvMultipler`: max bonus from the character growth stage (0.5 = +50%). */
    growthStageMaxBonus: 0.5,

} as const;

export type RewardConfig = { readonly [ K in keyof typeof REWARD_CONFIG ]: number };

/** Stored with every awarded reward (`records.formula_version`). */
export const REWARD_FORMULA_VERSION = "1.0";

/** Time zone that decides what "today" is for streaks. */
export const REWARD_DAY_TIMEZONE = "Asia/Tokyo";

/** How far back (days) the project streak looks. Keeps the query bounded. */
export const PROJECT_STREAK_LOOKBACK_DAYS = 400;

/**
 * Multiplies every character's `growth_step` XP requirement. Task XP is ~50-160 per task,
 * so the raw growth_step (50 XP per early level) would level up on nearly every task.
 * Existing project XP was multiplied once by this value in the 20261123000001 migration;
 * if you change it later, rescale `projects.character_xp` the same way or levels will shift.
 */
export const LEVEL_XP_REQUIREMENT_SCALE = 5;

/** Resources (resource_id -> quantity) given for every completed task. */
export const TASK_COMPLETION_RESOURCES: Readonly<Record<string, number>> = { 1: 1, 2: 1, 3: 1 };
