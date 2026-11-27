import { isWorkDayKey } from "@/lib/next-action/schedule";
import { WEEKDAYS, workDayNames } from "@/lib/projects/work-days";
import { addDaysToKey, isoWeekdayOfKey } from "@/lib/rewards/streaks";
import { SCHEDULE_TOOL_DEFAULT_DAYS } from "@/lib/schedule/config";
import { dayTotal, entriesForDay } from "@/lib/schedule/days";
import { capacityOf, isSchedulableState, openCountByNode } from "@/lib/schedule/rules";
import { tool } from "ai";
import { z } from "zod";
import { loadToolSchedule } from "./schedule-data";

export const listSchedule = tool({
    description:
        "Read the project's schedule: which tree tasks the user planned on which day, from today on (default 14 days). " +
        "Each day has date, weekday, is_work_day, planned_minutes vs daily_goal_minutes, and entries (item_id, node_id, task, status, minutes). " +
        "status: open = planned; carried = an unfinished entry of an earlier day, shown on today; done = completed (frozen, never change it); " +
        "stale = its task was completed or changed in the tree. Also returns schedulable tasks with how many more times each can be planned " +
        "(one-time tasks once, repeating tasks up to their remaining repetitions). Read-only. Call it before propose_schedule.",
    inputSchema: z.object({
        project_id: z.string().describe( "The exact active project_id from the system prompt." ),
        from: z.string().optional().describe( "First day to list, YYYY-MM-DD (default today)." ),
        days: z.number().int().min( 1 ).max( 60 ).optional().describe( `How many days to list (default ${SCHEDULE_TOOL_DEFAULT_DAYS}).` ),
    }),
    execute: async ({ project_id, from, days }) => {

        const view = await loadToolSchedule( project_id );
        const start = from && /^\d{4}-\d{2}-\d{2}$/.test( from ) ? from : view.todayKey;
        const count = days ?? SCHEDULE_TOOL_DEFAULT_DAYS;
        const open = openCountByNode( view.items );

        return {
            today: view.todayKey,
            daily_goal_minutes: view.goalMinutes,
            work_days: view.workDays.length ? workDayNames( view.workDays ) : "every day",
            target_date: view.goalKey,
            days: Array.from( { length: count }, ( _, i ) => addDaysToKey( start, i ) ).map( key => {
                const entries = entriesForDay( view.entries, key, view.todayKey );
                const total = dayTotal( key, entries, view.goalMinutes );
                return {
                    date: key,
                    weekday: WEEKDAYS[ isoWeekdayOfKey( key ) - 1 ].en,
                    is_work_day: isWorkDayKey( key, view.workDays ),
                    planned_minutes: total.minutes,
                    over_daily_goal: total.over,
                    entries: entries.map( e => ( {
                        item_id: e.id,
                        node_id: e.nodeId,
                        task: e.name,
                        status: e.state,
                        ...( e.state === "carried" ? { originally: e.dayKey } : {} ),
                        minutes: e.estimateMinutes || null,
                    } ) ),
                };
            } ),
            schedulable: view.nodes.filter( n => isSchedulableState( n.state ) ).map( n => ( {
                node_id: n.id,
                task: n.name,
                path: n.path.join( " > " ) || null,
                minutes: n.estimateMinutes || null,
                repeating: n.isLoop ? `${n.repetitionsCompleted}/${n.repetitionsRequired} done` : null,
                can_schedule_times: capacityOf( n, open.get( n.id ) ?? 0 ),
                waiting_for_subtasks: n.state === "blocked",
            } ) ),
        };

    },
});
