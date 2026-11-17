import { getProject } from '@/lib/projects';
import { tool } from 'ai';
import { z } from 'zod';

const WEEKDAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
];

function contextValue(value: unknown): string | null {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value.toISOString();
    }

    return typeof value === "string" && value.trim() ? value.trim() : null;
}

export const getProjectInformation = tool({
  description: 'Fetch the project information from database with the provided project id',
  inputSchema: z.object({
    project_id: z.string().describe('The target project uuid'),
  }),
  execute: async ({ project_id }) => {

    const project: Project = await getProject( project_id );

    // Project rows use Monday-first work days, as in the project dashboard.
    const workDays = project?.work_days;
    const hasValidSchedule =
        Array.isArray(workDays) &&
        workDays.length === WEEKDAYS.length &&
        workDays.every((day) => typeof day === "boolean");

    // Include planning context rather than the entire database row (IDs,
    // ownership, and character metadata are unnecessary for goal planning).
    const projectContext = {
        name: contextValue(project?.name),
        description: contextValue(project?.description),
        final_goal: contextValue(project?.final_goal),
        target_date: contextValue(project?.achieve_data_goal),
        created_at: contextValue(project?.created_at),
        daily_time_goal: contextValue(project?.daily_time_goal),
        work_days: hasValidSchedule
        ? WEEKDAYS.filter((_, index) => workDays[index])
        : null,
        streak_days:
        typeof project?.streak === "number" &&
        Number.isFinite(project.streak) &&
        project.streak >= 0
            ? project.streak
            : null,
    };

    return projectContext;

  },
});
