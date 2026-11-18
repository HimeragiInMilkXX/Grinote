import { TaskNodeType } from "@/types/flow";
import { Edge } from "@xyflow/react";
import { tool } from "ai"
import { z } from "zod"

const goalTreeNodesSchema = z.array(

    z.object({

        key: z.string().min(1).max(100).describe(
            "Unique temporary key for this NEW node, e.g. practice-basics. Use a short non-UUID key; never copy an existing node into graph or generate a UUID."
        ),
        parentKey: z.string().min(1).max(100).nullable().describe(
            "Required parent reference: an existing incomplete parent's exact ID from get_graph_info, or another new node's key from this draft. Existing parents stay OUT of graph. Never null or the node's own key; every chain must reach the saved root."
        ),
        
        position: z.object({

            x: z.number().describe(
                "Approximate numeric horizontal position: use depth from the saved root times 300. Saved node positions are unavailable; do not guess them."
            ),
            y: z.number().describe(
                "Approximate numeric vertical position. Give proposed leaves separate rows at least 120 units apart and center new parents over their children."
            )

        }).describe(
            "Required object with numeric x and y, e.g. {x:600,y:120}. Place only proposed nodes; the app can lay out the merged graph."
        ),

        task_name: z.string().min(1).max(100).describe("Short, specific label, at most 100 characters."),
        bg_color: z.string().min(1).max(100).refine( s => s.includes("#") || s.includes("rgb") ).describe(
            "Required CSS hex color. Use #FFFFFF unless a different color is useful."
        ),
        text_color: z.string().min(1).max(100).refine( s => s.includes("#") || s.includes("rgb") ).describe(
            "Required CSS hex text color with readable contrast. Use #000000 with #FFFFFF background."
        ),
        description: z.string().describe("Required string: one or two short sentences explaining the outcome; may be empty for a simple label."),
        time_limit: z.object({
            hours: z.number().min(0).max(10).describe("Whole hours in ONE session, integer 0-10. Never total project or milestone hours."),
            minutes: z.number().min(0).max(59).describe("Remaining minutes, integer 0-59. Convert 90 minutes to hours:1, minutes:30, seconds:0."),
            seconds: z.number().min(0).max(59).describe("Remaining seconds, integer 0-59; normally 0.")
        }).describe(
            "Required duration OBJECT with all three numeric fields, never a string, null, or total minutes. " +
            "For an action, estimate one session of at least 2 minutes within the user's availability. For loops this is per repetition. " +
            "Split long work into smaller sessions rather than exceeding hours:10 or minutes:59. " +
            "For a non-action label use {hours:0,minutes:2,seconds:0}, an unused placeholder matching the editor defaults; do not count it as work."
        ),
        isAction: z.boolean().describe(
            "Required boolean: true for work the user performs; false for a milestone or grouping label. Prefer actionable leaves and non-action groupings."
        ),
        isLoop: z.boolean().describe(
            "Required boolean: true only for an action repeated across sessions. False for one-time actions and all non-action labels."
        ),
        repetitions_required: z.number().describe(
            "Required integer. For a loop, total number of sessions, at least 2; time_limit is the duration of EACH session. For non-loops use 2 as the editor-compatible unused default; isLoop:false makes the action one-time."
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
        "Create an append-only goal-tree DRAFT for review; this does not save the project. " +
        "Inspect get_graph_info for this request first; reuse its result rather than fetching it repeatedly. " +
        "Attach to a relevant incomplete grouping or root automatically when clear. Break down an existing action only when requested: its children must finish before the action can start. " +
        "Identify the root by isRoot, not its name or array order. " +
        "Every new node must have exactly one parent and ultimately descend from that existing root, without cycles. " +
        "Do not include or edit existing nodes, replace the root, reparent saved nodes, or add edges whose child is existing. " +
        "Never connect an appended node to an existing isCompleted node in either direction. If no valid attachment exists, explain why instead of generating an invalid proposal. " +
        "Include only new nodes in graph, using unique non-UUID keys. Reference an existing parent by its exact UUID from get_graph_info, " +
        "or a new parent by its temporary key; do not copy existing parents into the proposal. " +
        "Usually add 3-8 nodes, at most 12 per draft, with concrete actionable leaves. For a large goal, draft a coherent first branch and explain the remaining scope. " +
        "Produce one successful draft per response; retry a failed invalid-input call at most once with corrected arguments. Include every required node field, including position, both colors, and a normalized time_limit object. " +
        "Pass the flat array of NEW node inputs, not {nodes,edges}, React Flow objects, saved database rows, or code. " +
        "If revising an unaccepted draft, regenerate the whole small replacement draft from saved parents: previous draft IDs are not saved. " +
        "After success give a short summary and let the built-in review card collect acceptance; do not ask_user for approval or create another draft.",

    inputSchema: z.object({
        project_id: z.string().describe("The exact active project_id from the system prompt; never a node ID."),

        goal: z.string().min(1).max(250).describe("Brief goal of THIS draft branch, at most 250 characters; not the full project description."),
        
        graph: goalTreeNodesSchema.describe("Flat array containing ONLY new nodes with all required fields, ideally 3-8 and at most 12. Existing parents are referenced by parentKey, never copied here.")
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
