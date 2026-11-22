import { countRecordsForNodes, fetchGraph } from "@/app/project/[projectId]/tree/serverActions";
import { applyTreeChanges, MAX_OPS, normalizeOps, type ProtectedNode, type TreeChangeOps, type TreeDiff } from "@/lib/tree/tree-changes";
import { tool } from "ai"
import { z } from "zod"

const color = ( what: string ) => z.string().min(1).max(100).refine( s => s.includes("#") || s.includes("rgb"), { message: "Use a CSS hex color such as #FFFFFF" } ).describe(what);

export const timeLimitSchema = z.object({
    hours: z.number().int().min(0).max(10).describe("Whole hours in ONE session, integer 0-10. Never total project or milestone hours."),
    minutes: z.number().int().min(0).max(59).describe("Remaining minutes, integer 0-59. Convert 90 minutes to hours:1, minutes:30, seconds:0."),
    seconds: z.number().int().min(0).max(59).describe("Remaining seconds, integer 0-59; normally 0.")
}).describe(
    "Duration OBJECT with all three numeric fields, never a string, null, or total minutes. " +
    "For an action, one session of at least 2 minutes within the user's availability; for loops, per repetition. " +
    "Split long work instead of exceeding hours:10. For a non-action label use {hours:0,minutes:2,seconds:0}."
);

export const addNodeSchema = z.object({
    key: z.string().min(1).max(100).describe("Unique temporary key for this NEW node, e.g. practice-basics. Never an existing node ID or a UUID."),
    parentKey: z.string().min(1).max(100).describe(
        "Parent: an existing node's exact ID from get_graph_info (not completed), or another new node's key from add. Never empty or the node's own key."
    ),
    task_name: z.string().min(1).max(100).describe("Short, specific label, at most 100 characters."),
    isAction: z.boolean().describe("true for work the user performs; false for a milestone or grouping label."),
    time_limit: timeLimitSchema,
    description: z.string().optional().describe("One or two short sentences explaining the outcome. Optional."),
    isLoop: z.boolean().optional().describe("true only for an action repeated across sessions. Default false."),
    repetitions_required: z.number().int().min(1).optional().describe("For a loop, total sessions, at least 2. Default 2 (unused when isLoop is false)."),
    bg_color: color("CSS hex background color. Default #FFFFFF.").optional(),
    text_color: color("CSS hex text color with readable contrast. Default #000000.").optional(),
});

export const updateChangesSchema = z.object({
    task_name: z.string().min(1).max(100).optional(),
    description: z.string().optional(),
    isAction: z.boolean().optional(),
    time_limit: timeLimitSchema.optional(),
    isLoop: z.boolean().optional(),
    repetitions_required: z.number().int().min(1).optional().describe("Cannot be lower than repetitions_completed."),
    bg_color: color("CSS hex background color.").optional(),
    text_color: color("CSS hex text color.").optional(),
}).passthrough().describe("ONLY the fields that change, e.g. {task_name:\"New name\"}. Never isRoot, isCompleted or repetitions_completed.");

export const updateNodeSchema = z.object({
    id: z.string().min(1).describe("Exact ID of an existing node from get_graph_info. Must not be the root or a completed node."),
    changes: updateChangesSchema,
    reason: z.string().max(200).optional().describe("Short reason shown to the user."),
});

export const moveNodeSchema = z.object({
    id: z.string().min(1).describe("Exact ID of the existing node to move (its whole branch moves with it). Not the root or a completed node."),
    newParent: z.string().min(1).describe("Exact ID of the new existing parent, or a key from add. This removes the old connection and creates the new one."),
    reason: z.string().max(200).optional().describe("Short reason shown to the user."),
});

export const deleteNodeSchema = z.object({
    id: z.string().min(1).describe("Exact ID of the existing node to delete. Not the root or a completed node. Its children move up to its parent unless you move or delete them too."),
    reason: z.string().max(200).optional().describe("Short reason shown to the user."),
});

export const proposeGoalTreeInputSchema = z.object({
    project_id: z.string().describe("The exact active project_id from the system prompt; never a node ID."),
    goal: z.string().min(1).max(250).optional().default("ツリーの変更案").describe("Brief summary of what THIS proposal changes, at most 250 characters."),
    add: z.array(addNodeSchema).optional().default([]).describe("New nodes to create. Omit or [] if none."),
    update: z.array(updateNodeSchema).optional().default([]).describe("Edits to existing nodes' content. Omit or [] if none."),
    move: z.array(moveNodeSchema).optional().default([]).describe("Reconnect existing nodes under a different parent (break + connect). Omit or [] if none."),
    delete: z.array(deleteNodeSchema).optional().default([]).describe("Existing nodes to remove. Omit or [] if none."),
});

export type ProposeGoalTreeInput = z.infer<typeof proposeGoalTreeInputSchema>;

export type ProposeGoalTreeOutput = {
    status: "draft";
    goal: string;
    project_id: string;
    /** Normalized operations (temp keys replaced by UUIDs, references resolved). */
    ops: TreeChangeOps;
    diff: TreeDiff;
    protectedNodes: ProtectedNode[];
    warnings: string[];
    requiresConfirmation: true;
};

/** Short plain-text summary for the model, so the full diff does not fill its context. */
export function summarizeForModel( output: ProposeGoalTreeOutput ): string {
    const { diff, protectedNodes, warnings } = output;
    const lines = [
        `Draft created (not saved): ${diff.added.length} added, ${diff.updated.length} updated, ${diff.moved.length} moved, ${diff.deleted.length} deleted.`,
        ...diff.added.map( a => `+ ${a.task_name} under ${diff.names[a.parentId ?? ""] ?? a.parentId}` ),
        ...diff.updated.map( u => `~ ${u.task_name}: ${Object.keys(u.after).join(", ")}` ),
        ...diff.moved.map( m => `> ${m.task_name}: ${diff.names[m.fromParentId ?? ""] ?? "none"} -> ${diff.names[m.toParentId ?? ""] ?? "none"}${m.auto ? " (auto, parent deleted)" : ""}` ),
        ...diff.deleted.map( d => `- ${d.task_name}` ),
    ];
    if( protectedNodes.length )
        lines.push( `Needs user permission on the review card (repeating tasks with progress): ${protectedNodes.map( p => p.task_name ).join(", ")}.` );
    if( warnings.length ) lines.push( `Warnings: ${warnings.join(" ")}` );
    lines.push( "The review card is now shown to the user. Summarize briefly and stop; do not ask_user for approval or create another draft." );
    return lines.join("\n");
}

export const proposeGoalTree = tool({
    description:
        "Create a goal-tree change DRAFT for the user to review; this does not save anything. " +
        "Call get_graph_info for this request first and use its exact node IDs. " +
        "Supports four operation lists in one call: add (new nodes), update (edit existing node content), move (reconnect an existing node under another parent), delete (remove existing nodes). Use only the lists you need. " +
        "Locked nodes (locked in get_graph_info): the root and completed nodes can never be updated, moved, deleted, or connected to. " +
        "Repeating tasks with progress (locked: loop_in_progress) may be changed only if the user wants it; the review card asks the user to allow it. " +
        "Every node must stay connected to the root with exactly one parent and no cycles. Deleting a node moves its children up to its parent unless you also move or delete them. " +
        `Use at most ${MAX_OPS} operations in total; for bigger requests, do the most important part and explain the rest. ` +
        "If the tool returns an error, read it, fix the arguments and retry at most once. " +
        "After success give a short summary and let the review card collect acceptance; do not ask_user for approval or create another draft.",

    inputSchema: proposeGoalTreeInputSchema,

    execute: async ({ goal, project_id, ...input }): Promise<ProposeGoalTreeOutput> => {

        const graph = await fetchGraph( project_id );

        const { ops, warnings: normalizeWarnings } = normalizeOps( graph, input as Partial<TreeChangeOps> );

        const result = applyTreeChanges( graph, ops, { allowedProtectedIds: "all" } );

        if( result.errors.length > 0 ) {
            throw new Error( `Invalid proposal, nothing was created. Fix these problems and retry once:\n- ${result.errors.join("\n- ")}` );
        }

        const warnings = [ ...normalizeWarnings, ...result.warnings ];

        // Deleting a node also deletes its work records (ON DELETE CASCADE)
        const deletedIds = result.diff.deleted.map( d => d.id );
        if( deletedIds.length > 0 ) {
            const counts = await countRecordsForNodes( project_id, deletedIds );
            result.diff.deleted.forEach( d => {
                if( counts[d.id] ) warnings.push( `「${d.task_name}」の作業記録 ${counts[d.id]} 件も削除されます。` );
            });
        }

        return {
            status: "draft",
            goal,
            project_id,
            ops,
            diff: result.diff,
            protectedNodes: result.protectedNodes,
            warnings,
            requiresConfirmation: true,
        };
    },

    toModelOutput: ({ output }) => ({ type: "text", value: summarizeForModel( output ) }),
})
