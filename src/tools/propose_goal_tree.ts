import { TaskNodeType } from "@/types/flow";
import { Edge } from "@xyflow/react";
import { tool } from "ai"
import { z } from "zod"

const goalTreeNodesSchema = z.array(

    z.object({

        key: z.string().min(1).max(100).describe(
            "Unique non-UUID temporary key for a new node, such as practice-basics. UUID keys are reserved for existing nodes verified by get_graph_info; do not invent UUIDs or copy existing nodes into an append-only proposal."
        ),
        parentKey: z.string().min(1).max(100).nullable().describe(
            "For a new parent, use its temporary key in this proposal. For an existing parent, use its exact UUID from get_graph_info, even when it is not in this proposal. Every new node needs a parent and must ultimately connect to the existing isRoot node; do not use null for new nodes."
        ),
        
        position: z.object({

            x: z.number().describe(
                "Node top-left horizontal coordinate in graph units. Use depth * columnSpacing, with the root at depth 0 and columnSpacing at least 300, increased for long labels."
            ),
            y: z.number().describe(
                "Node top-left vertical coordinate in graph units, increasing downward. Assign leaves distinct rows at least 120 units apart across the entire tree; position each parent midway between its first and last child's y coordinates."
            )

        }).describe(
            "Calculated initial React Flow position for a readable left-to-right tree. Lay out the complete tree together, reserving a separate vertical band for each subtree rather than restarting rows within each branch."
        ),

        task_name: z.string().min(1).max(100),
        bg_color: z.string().min(1).max(100).refine( s => s.includes("#") || s.includes("rgb") ),
        text_color: z.string().min(1).max(100).refine( s => s.includes("#") || s.includes("rgb") ),
        description: z.string(),
        time_limit: z.object({
            hours: z.number().min(0).max(10),
            minutes: z.number().min(0).max(59),
            seconds: z.number().min(0).max(59)
        }),
        isAction: z.boolean().describe(
            "True for a task the user works on; false for a label or grouping only."
        ),
        isLoop: z.boolean().describe(
            "True for a repetitive task such as practising. May be true only when isAction is true; false for one-time tasks and label-only nodes."
        ),
        repetitions_required: z.number().describe(
            "The number of repetitions required to complete a repetitive task when isLoop is true."
        )

    })
)

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type GoalTreeNodes = z.infer<typeof goalTreeNodesSchema>;

function convertGoalTreeToGraph( proposal: GoalTreeNodes ): { nodes: TaskNodeType[], edges: Edge[] } {

    const keyToUUID: Record<string, string> = Object.fromEntries(
        proposal.map(item => [ item.key, !uuidRegex.test(item.key) ? crypto.randomUUID() : item.key])
    );

    const nodes: TaskNodeType[] = [];
    const edges: Edge[] = [];

    proposal.forEach( item => {

        const { key, parentKey, position, ...node } = item;

        const itemId = keyToUUID[key];

        let parentId;

        if( parentKey ) parentId = keyToUUID[parentKey] ?? parentKey

        nodes.push({

            id: itemId,
            position: position,
            connectable: true,
            selectable: true,
            draggable: true,
            data: {

                label: item.task_name,
                task: {

                    ...node,
                    isCompleted: false,
                    repetitions_completed: 0,
                    isRoot: false

                }

            },
            type: 'taskNode'

        })

        if( !parentId ) return;

        edges.push({

            id: `${parentId}-${itemId}`,
            source: parentId,
            target: itemId,
            sourceHandle: 'source',
            targetHandle: 'target',
            deletable: true,
            type: "smoothstep",
            animated: true

        })

    })

    return { nodes, edges };

}

export const proposeGoalTree = tool({
    description:
        "Propose new nodes and parent-child edges for a real project graph, as a draft requiring user confirmation. Never save or modify the project. " +
        "First call get_graph_info to inspect existing IDs, isRoot, isCompleted, and relationships. " +
        "Automatically attach new branches to relevant incomplete task or label nodes without asking where to connect; " +
        "otherwise use the existing root if incomplete. Identify the root by isRoot, not its name or array order. " +
        "Every new node must have exactly one parent and ultimately descend from that existing root, without cycles. " +
        "Preserve all existing nodes, positions, and relationships: do not replace the root, reparent existing nodes, or add edges whose child is existing. " +
        "Never connect an appended node to an existing isCompleted node in either direction. If no valid attachment exists, explain why instead of generating an invalid proposal. " +
        "Include only new nodes in graph, using unique non-UUID keys. Reference an existing parent by its exact UUID from get_graph_info, " +
        "or a new parent by its temporary key; do not copy existing parents into the proposal. " +
        "Break goals into realistic subgoals with any useful branching and depth, stopping at concrete actionable tasks. " +
        "Provide readable left-to-right positions using the field guidance; reserve separate vertical bands for subtrees. " +
        "Use isAction for work the user performs, and isLoop only for repetitive actions with repetitions_required; labels are neither actions nor loops.",

    inputSchema: z.object({
        project_id: z.string().describe("Put the project id here"),

        goal: z.string().min(1).max(250),
        
        graph: goalTreeNodesSchema
    }),

    execute: async ({ goal, project_id, graph }) => {
        const { nodes, edges } = convertGoalTreeToGraph( graph )

        return {
            status: "draft" as const,
            goal,
            project_id,
            graph: { nodes, edges },
            requiresConfirmation: true,
        }
    },
})
