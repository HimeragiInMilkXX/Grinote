import { getProject } from '@/lib/projects';
import { tool } from 'ai';
import { z } from 'zod';
import { workDayNames } from '@/lib/projects/work-days';

function contextValue(value: unknown): string | null {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value.toISOString();
    }

    return typeof value === "string" && value.trim() ? value.trim() : null;
}

export const getProjectInformation = tool({
  description: 'Read saved project goal, description, deadline, daily time budget, selected work days and streak. Use when planning depends on those details; inspect before asking the user to repeat them. Reuse within the same request. This is read-only and does not return the task graph; use get_graph_info for saved nodes and progress.',
  inputSchema: z.object({
    project_id: z.string().describe('The target project uuid'),
  }),
  execute: async ({ project_id }) => {

    const project: Project = await getProject( project_id );

    // work_days holds ISO weekday numbers (1 = Monday ... 7 = Sunday).
    const workDays = Array.isArray( project?.work_days ) ? workDayNames( project.work_days ) : null;

    // Include planning context rather than the entire database row (IDs,
    // ownership, and character metadata are unnecessary for goal planning).
    const projectContext = {
        name: contextValue(project?.name),
        description: contextValue(project?.description),
        final_goal: contextValue(project?.final_goal),
        target_date: contextValue(project?.achieve_date_goal),
        created_at: contextValue(project?.created_at),
        daily_time_goal: contextValue(project?.daily_time_goal),
        work_days: workDays,
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
