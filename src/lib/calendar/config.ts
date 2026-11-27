import { REWARD_DAY_TIMEZONE } from "@/lib/rewards/config";

/**
 * How many weeks the calendar shows on each side of the current week:
 * past N weeks + this week + future N weeks.
 */
export const CALENDAR_WEEKS_AROUND = 4;

/** Day boundaries for the calendar (same day as streaks and rewards). */
export const CALENDAR_TIMEZONE = REWARD_DAY_TIMEZONE;
