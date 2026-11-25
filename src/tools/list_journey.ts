import { tool } from "ai";
import { z } from "zod";
import { cut, dayKey, entryAiFields, entryWorkFields, loadJourney, minutes } from "./journey-data";

const DEFAULT_LIMIT = 15;

export const listJourney = tool({
    description:
        "List the project's journey: every completed task (newest first) with its date, estimated minutes, actual focus minutes (breaks and pauses excluded), " +
        "how they worked (work: timer used such as pomodoro/deep/starter/flowtime, focus sessions, breaks with minutes, pauses; null before timers existed), XP, the user's short reflections, " +
        "and the AI review of that session (effort score 0-100, conclusion, struggles, suggested next actions), plus totals " +
        "(focus time, focus sessions, break time, completed tasks, current and longest streak). Read-only. " +
        "Call this when the user talks about their progress, what they struggled with, what to do next, or before planning or changing the goal tree. " +
        "Use read_journey_entry for the full report of one task.",
    inputSchema: z.object({
        project_id: z.string().describe("The exact active project_id from the system prompt."),
        limit: z.number().int().min( 1 ).max( 50 ).optional().describe("How many recent tasks to return (default 15)."),
    }),
    execute: async ({ project_id, limit }) => {

        const { entries, stats } = await loadJourney( project_id );
        const count = limit ?? DEFAULT_LIMIT;

        return {
            totals: {
                focus_minutes: minutes( stats.totalWorkMs / 60000 ),
                focus_sessions: stats.totalSessions,
                break_minutes: minutes( stats.totalBreakMs / 60000 ),
                completed_tasks: stats.completedTasks,
                current_streak_days: stats.currentStreak,
                longest_streak_days: stats.longestStreak,
                project_started: dayKey( stats.startedAt ),
            },
            entries: entries.slice( 0, count ).map( e => ( {
                record_id: e.recordId,
                date: dayKey( e.completedAt ),
                task_name: e.taskName,
                estimated_minutes: e.estimatedMinutes > 0 ? minutes( e.estimatedMinutes ) : null,
                actual_minutes: minutes( e.actualMinutes ),
                ...entryWorkFields( e ),
                xp: e.xp,
                reflection: e.journal ? {
                    learned: cut( e.journal.reflection.learned, 200 ),
                    difficult: cut( e.journal.reflection.difficult, 200 ),
                    next: cut( e.journal.reflection.next, 200 ),
                } : null,
                ...entryAiFields( e ),
            } ) ),
            has_more: entries.length > count,
        };

    },
});
