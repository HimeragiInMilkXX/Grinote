import { fetchGraph } from '@/app/project/[projectId]/tree/serverActions';
import { tool } from 'ai';
import { z } from 'zod';

function contextValue(value: unknown): string | null {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value.toISOString();
    }

    return typeof value === "string" && value.trim() ? value.trim() : null;
}

export const getGraphInformation = tool({
  description: 'Fetch the project existing task graph and progress from the database with the provided project id',
  inputSchema: z.object({
    project_id: z.string().describe('The target project uuid'),
  }),
  execute: async ({ project_id }) => {

    const graph = await fetchGraph( project_id );

    // Preserve task IDs and relationships, but omit canvas coordinates,
    // colors, handles, and other presentation-only React Flow properties.
    // Keep the graph flat so disconnected nodes and cycles are not lost.
    const graphContext = {
        nodes: Array.isArray(graph?.nodes)
            ? graph.nodes.map((node) => {
                const task = node.data?.task;

                return {
                    id: node.id,
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
