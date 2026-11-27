import { MAX_ADD_COUNT, MAX_SCHEDULE_OPS } from "@/lib/schedule/config";
import { normalizeScheduleOps, ScheduleOpsError } from "@/lib/schedule/normalize";
import type { DayChange, ScheduleOps } from "@/lib/schedule/types";
import { tool } from "ai";
import { z } from "zod";
import { loadToolSchedule } from "./schedule-data";

const date = z.string().describe( "Day as YYYY-MM-DD: today or later, not after the target date." );

export const proposeScheduleInputSchema = z.object({
    project_id: z.string().describe( "The exact active project_id from the system prompt." ),
    summary: z.string().max( 250 ).optional().default( "スケジュールの提案" ).describe( "One short sentence describing this proposal." ),
    add: z.array( z.object({
        node_id: z.string().describe( "Exact node_id of a task from list_schedule's schedulable list." ),
        date,
        count: z.number().int().min( 1 ).max( MAX_ADD_COUNT ).optional().describe( "Times on that day; only repeating tasks may use more than 1 (default 1)." ),
    }) ).optional().default( [] ).describe( "Plan a task on a day. A one-time task can be planned once; a repeating task up to can_schedule_times." ),
    move: z.array( z.object({
        item_id: z.string().describe( "Exact item_id of an open or carried entry from list_schedule." ),
        date,
    }) ).optional().default( [] ).describe( "Move a planned (not done) entry to another day." ),
    remove: z.array( z.object({
        item_id: z.string().describe( "Exact item_id of an open, carried or stale entry. Never a done entry." ),
    }) ).optional().default( [] ).describe( "Remove a planned (not done) entry." ),
});

export type ProposeScheduleOutput = {
    status: "draft";
    project_id: string;
    summary: string;
    /** today's key when the draft was made */
    today: string;
    ops: ScheduleOps;
    /** node id -> task name */
    nodeNames: Record<string, string>;
    /** item id -> { task name, current day } */
    itemInfo: Record<string, { name: string; date: string }>;
    days: DayChange[];
    warnings: string[];
};

export const proposeSchedule = tool({
    description:
        "Create a schedule DRAFT for the user to review; nothing is saved until the user ticks and applies it on the review card. " +
        "The schedule is the user's own plan: use this only when the user asks you to plan, fill, move or clear days. " +
        "Call list_schedule first and use its exact node_id / item_id values. Lists: add (task + day), move (entry to another day), remove (entry). " +
        "Done entries are frozen. Days before today or after the target date are rejected. Going over the daily goal is allowed but say so. " +
        `At most ${MAX_SCHEDULE_OPS} changes. If it returns an error, fix the arguments and retry once. After success, summarize briefly and stop.`,
    inputSchema: proposeScheduleInputSchema,
    execute: async ({ project_id, summary, ...input }): Promise<ProposeScheduleOutput> => {

        const view = await loadToolSchedule( project_id );

        let normalized;
        try {
            normalized = normalizeScheduleOps( input, {
                todayKey: view.todayKey,
                goalKey: view.goalKey,
                workDays: view.workDays,
                goalMinutes: view.goalMinutes,
                nodes: view.nodes,
                items: view.items,
            } );
        } catch( e ) {
            if( e instanceof ScheduleOpsError ) throw new Error( `Invalid schedule proposal (today is ${view.todayKey}):\n- ${e.problems.join( "\n- " )}` );
            throw e;
        }

        const nodeNames = Object.fromEntries( view.nodes.map( n => [ n.id, n.name ] ) );

        return {
            status: "draft",
            project_id,
            summary,
            today: view.todayKey,
            ops: normalized.ops,
            nodeNames,
            itemInfo: Object.fromEntries( view.entries.map( e => [ e.id, { name: e.name, date: e.dayKey } ] ) ),
            days: normalized.days,
            warnings: normalized.warnings,
        };

    },
    toModelOutput: ({ output }) => {
        const { ops, nodeNames, itemInfo } = output;
        const lines = [
            `Schedule draft created (not saved): ${ops.add.reduce( ( s, a ) => s + a.count, 0 )} added, ${ops.move.length} moved, ${ops.remove.length} removed.`,
            ...ops.add.map( a => `+ ${nodeNames[ a.node_id ]} on ${a.date}${ a.count > 1 ? ` x${a.count}` : "" }` ),
            ...ops.move.map( m => `> ${itemInfo[ m.item_id ]?.name} ${itemInfo[ m.item_id ]?.date} -> ${m.date}` ),
            ...ops.remove.map( r => `- ${itemInfo[ r.item_id ]?.name} (${itemInfo[ r.item_id ]?.date})` ),
            ...output.days.map( d => `${d.key}: ${d.beforeMinutes} -> ${d.afterMinutes} min${ d.goalMinutes ? ` (daily goal ${d.goalMinutes})` : "" }` ),
        ];
        if( output.warnings.length ) lines.push( `Warnings: ${output.warnings.join( " " )}` );
        lines.push( "The review card is now shown to the user. Summarize briefly and stop; do not create another draft." );
        return { type: "text", value: lines.join( "\n" ) };
    },
});
