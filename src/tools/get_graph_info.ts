import { fetchGraph } from '@/app/project/[projectId]/tree/serverActions';
import { lockReason } from '@/lib/tree/tree-changes';
import { tool } from 'ai';
import { z } from 'zod';

function contextValue(value: unknown): string | null {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value.toISOString();
    }

    return typeof value === "string" && value.trim() ? value.trim() : null;
}

export const getGraphInformation = tool({
  description: 'Read the saved project graph before proposing any change or checking existing tasks. Returns flat nodes with exact IDs, parent_id, flags, durations, colors, progress and a locked reason ("root" and "completed" can never be changed; "loop_in_progress" needs the user permission), plus source(parent)-target(child) edges. Does not include positions, unsaved canvas edits, or unaccepted drafts. Reuse this snapshot within the same request; refresh after reported saved changes. Read-only; never pass its nodes directly to propose_goal_tree.',
  inputSchema: z.object({
    project_id: z.string().describe('The target project uuid'),
  }),
  execute: async ({ project_id }) => {

    const graph = await fetchGraph( project_id );

    const parentOf = new Map( ( graph?.edges ?? [] ).map( edge => [ edge.target, edge.source ] ) );

    // Preserve task IDs, relationships and colors (so updates can keep them),
    // but omit canvas coordinates, handles, and other React Flow properties.
    // Keep the graph flat so disconnected nodes and cycles are not lost.
    const graphContext = {
        nodes: Array.isArray(graph?.nodes)
            ? graph.nodes.map((node) => {
                const task = node.data?.task;

                return {
                    id: node.id,
                    parent_id: parentOf.get( node.id ) ?? null,
                    locked: lockReason( task ),
                    task_name: contextValue(task?.task_name) ?? contextValue(node.data?.label),
                    description: contextValue(task?.description),
                    isRoot: task?.isRoot ?? null,
                    isAction: task?.isAction ?? null,
                    isLoop: task?.isLoop ?? null,
                    isCompleted: task?.isCompleted ?? null,
                    time_limit: task?.time_limit
                        ? {
                            hours: task.time_limit.hours ?? null,
                            minutes: task.time_limit.minutes ?? null,
                            seconds: task.time_limit.seconds ?? null,
                        }
                        : null,
                    repetitions_required: task?.repetitions_required ?? null,
                    repetitions_completed: task?.repetitions_completed ?? null,
                    bg_color: task?.bg_color ?? null,
                    text_color: task?.text_color ?? null,
                };
            })
            : null,
        edges: Array.isArray(graph?.edges)
            ? graph.edges.map((edge) => ({
                source: edge.source,
                target: edge.target,
            }))
            : null,
    };

    return graphContext;

  },
});
