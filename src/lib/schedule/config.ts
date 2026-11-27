import { REWARD_DAY_TIMEZONE } from "@/lib/rewards/config";

/**
 * User-defined project schedule (MVP 6.0). See docs/schedule.md.
 * Days are "YYYY-MM-DD" keys in this zone (same day as streaks, rewards, calendar, next action).
 */
export const SCHEDULE_TIMEZONE = REWARD_DAY_TIMEZONE;

/** At most this many add/move/remove operations in one request (UI add or AI proposal). */
export const MAX_SCHEDULE_OPS = 30;

/** One add operation may schedule a loop task this many times on the same day at most. */
export const MAX_ADD_COUNT = 10;

/** The schedule page can page at least this many weeks past the current one. */
export const SCHEDULE_MIN_WEEKS_AHEAD = 4;

/** Upper bound for the number of weeks the schedule page builds. */
export const SCHEDULE_MAX_WEEKS = 104;

/** How many days the assistant's list_schedule returns by default. */
export const SCHEDULE_TOOL_DEFAULT_DAYS = 14;
