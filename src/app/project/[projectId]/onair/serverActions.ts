"use server";

import { Task } from "@/types/flow";
import { OnAirRecord } from "@/types/records";
import { createActionClient } from "@/utils/supabase/actions";
import { createJournalSnapshot, type JournalNodeSnapshot } from "@/lib/journey/journal-db";
import { createClient, requireUser } from "@/utils/supabase/server";
import { errorMessage, intervalToDurationObject } from "@/utils/utils";
import { redirect } from "next/navigation";
import { z } from "zod";
import { applyTimerEvent, asTimerState, createTimer, legacyTimer, recordStatusFor, TimerRuleError } from "@/lib/timer/machine";
import { TIMER_MODES, type TimerChoice, type TimerEvent, type TimerState } from "@/lib/timer/types";
import { TIMER_BREAK_OVERRUN_GRACE_MS } from "@/lib/timer/server-config";

type RecordRow = Omit<OnAirRecord, "nodes" | "timer"> & { nodes: ( Omit<Task, "time_limit"> & { time_limit: string | null } ) | null; timer: unknown };

/** Converts the node's interval and makes sure an open record always has a timer (pre-4.5 rows get a flowtime one). */
function toOnAirRecord( row: RecordRow ): OnAirRecord {

    const timer = asTimerState( row.timer )
        ?? ( row.status === "active" || row.status === "paused"
            ? legacyTimer( Number( row.duration ) || 0, row.status === "active", new Date( row.updated_at ).getTime(), Date.now() )
            : null );

    return {
        ...( row as unknown as OnAirRecord ),
        nodes: row.nodes ? { ...row.nodes, time_limit: intervalToDurationObject( row.nodes.time_limit ?? "" ) } as OnAirRecord[ "nodes" ] : undefined,
        timer,
    };

}

export const getActiveTask = async ( project_id: string ): Promise<OnAirRecord | null> => {

    const supabase = await createClient();

    const { data: activeTask, error } = await supabase.from("records").select("*, nodes ( * )").eq("project_id", project_id).in( 'status', ["paused", "active"] );

    if( error ) throw error.message

    if( activeTask.length > 1 ) throw new Error("More than one task is active");

    if( activeTask.length < 1 ) return null;

    return toOnAirRecord( activeTask[0] as RecordRow );

}

/** The record whose report is still pending (timer stopped with 完成, no XP yet), if any. */
export const getPendingReport = async ( project_id: string ): Promise<{ id: number; node_id: string } | null> => {

    const supabase = await createClient();

    const { data, error } = await supabase.from( "records" ).select( "id, node_id" ).eq( "project_id", project_id ).eq( "status", "reviewing" ).limit( 1 );

    if( error ) throw error.message;

    return data?.[0] ?? null;

}

export const getTaskFromNode = async ( node_id: string, project_id: string ): Promise<Task> => {

    const supabase = await createClient();

    const { data: taskFromNode, error } = await supabase.from("nodes").select("*").eq("project_id", project_id).eq("id", node_id).single();

    if( error ) throw error.message;
    const task: Task = {

        ...taskFromNode,
        time_limit: intervalToDurationObject(taskFromNode.time_limit),

    }

    return task;

}

const modeSchema = z.enum( TIMER_MODES );
const configSchema = z.object( { flowSuggestMin: z.number().int().min( 5 ).max( 240 ).optional() } ).strict().optional();

const timerChoiceSchema = z.object( { mode: modeSchema, config: configSchema } );

const timerEventSchema: z.ZodType<TimerEvent> = z.discriminatedUnion( "type", [
    z.object( { type: z.literal( "pause" ), reason: z.string().max( 1000 ).nullish() } ),
    z.object( { type: z.literal( "resume" ) } ),
    z.object( { type: z.literal( "take_break" ) } ),
    z.object( { type: z.literal( "take_suggested_break" ) } ),
    z.object( { type: z.literal( "snooze_suggestion" ) } ),
    z.object( { type: z.literal( "end_break" ) } ),
    z.object( { type: z.literal( "session_due" ) } ),
    z.object( { type: z.literal( "accept_break" ) } ),
    z.object( { type: z.literal( "skip_break" ) } ),
    z.object( { type: z.literal( "starter_switch" ), mode: modeSchema, config: configSchema } ),
    z.object( { type: z.literal( "change_mode" ), mode: modeSchema, config: configSchema } ),
] ) as z.ZodType<TimerEvent>;

export type StartTaskResult = { ok: true } | { ok: false; message: string };

/**
 * Starts a task with the chosen timer (the picker on /onair?nodeId=…), then redirects to the
 * on-air page. Checks: no open record or pending report, an action node that isn't completed,
 * all direct children completed.
 */
export const startTask = async ( node_id: string, project_id: string, choice: TimerChoice ): Promise<StartTaskResult> => {

    const parsed = timerChoiceSchema.safeParse( choice );
    if( !parsed.success ) return { ok: false, message: "タイマーの選択が正しくありません" };

    const supabase = await createActionClient();

    try {

        const user = await requireUser( supabase );

        if( await getPendingReport( project_id ) ) return { ok: false, message: "先にタスクレポートを提出してください" };
        if( await getActiveTask( project_id ) ) return { ok: false, message: "進行中のタスクがあります" };

        const requestedTask = await getTaskFromNode( node_id, project_id );

        if( !requestedTask.isAction ) return { ok: false, message: "このノードは行動ではありません" };
        if( requestedTask.isCompleted ) return { ok: false, message: "このタスクはもう完了しています" };

        const { data: childrenNodes, error: childrenNodesError } = await supabase
            .from("nodes")
            .select("isCompleted")
            .eq("project_id", project_id).eq("parent_node_id", node_id);

        if( childrenNodesError ) throw new Error( childrenNodesError.message );

        if( childrenNodes?.some( node => !node.isCompleted ) ) return { ok: false, message: "先に子タスクをすべて完了してください" };

        const timer = createTimer( parsed.data.mode, parsed.data.config, Date.now() );

        const { error } = await supabase.from('records').insert([{

            user_id: user.id,
            node_id: node_id,
            project_id: project_id,
            timer,

        }]);

        if( error ) throw new Error( error.message );

    } catch( e ) {

        console.error( "[onair] startTask", errorMessage( e ) );
        return { ok: false, message: "タスクを開始できませんでした" };

    }

    redirect( `/project/${project_id}/onair` );

}

export type TimerActionResult =
    | { ok: true; record: OnAirRecord; serverNow: number }
    | { ok: false; message: string; record?: OnAirRecord; serverNow: number };

type OpenRecord = { id: number; status: string; duration: number; updated_at: string; timer: unknown };

/** Loads an open record with its timer (legacy rows get one). */
async function loadOpenTimer( supabase: Awaited<ReturnType<typeof createActionClient>>, record_id: number, project_id: string, statuses: string[] = [ "active", "paused" ] ) {

    const { data, error } = await supabase.from( "records" ).select( "id, status, duration, updated_at, timer" ).eq( "id", record_id ).eq( "project_id", project_id ).in( "status", statuses ).maybeSingle();

    if( error ) throw new Error( error.message );
    if( !data ) return null;

    const row = data as OpenRecord;
    const timer = asTimerState( row.timer ) ?? legacyTimer( Number( row.duration ) || 0, row.status === "active", new Date( row.updated_at ).getTime(), Date.now() );

    return { row, timer };

}

/** Writes a new timer state, only if nobody changed the row since it was read. */
async function saveTimer( supabase: Awaited<ReturnType<typeof createActionClient>>, row: OpenRecord, timer: TimerState, extra: Record<string, unknown> = {} ) {

    const { data, error } = await supabase
        .from( "records" )
        .update( { timer, duration: Math.round( timer.totals.workMs ), ...extra } )
        .eq( "id", row.id ).eq( "updated_at", row.updated_at ).eq( "status", row.status )
        .select( "*, nodes ( * )" );

    if( error ) throw new Error( error.message );

    return data?.[0] ? toOnAirRecord( data[0] as RecordRow ) : null;

}

/** Every timer transition (pause, break, session end, timer change, …) with server time. */
export const timerAction = async ( record_id: number, project_id: string, event: TimerEvent ): Promise<TimerActionResult> => {

    const serverNow = () => Date.now();

    const parsed = timerEventSchema.safeParse( event );
    if( !parsed.success ) return { ok: false, message: "不正な操作です", serverNow: serverNow() };

    const supabase = await createActionClient();

    try {

        await requireUser( supabase );

        const loaded = await loadOpenTimer( supabase, record_id, project_id );
        if( !loaded ) return { ok: false, message: "このタスクは進行中ではありません", serverNow: serverNow() };

        const now = serverNow();
        const next = applyTimerEvent( loaded.timer, parsed.data, now, { overrunGraceMs: TIMER_BREAK_OVERRUN_GRACE_MS } );

        const record = await saveTimer( supabase, loaded.row, next, { status: recordStatusFor( next ) } );

        if( !record ) {
            const fresh = await getActiveTask( project_id );
            return { ok: false, message: "別の画面で状態が変わりました。最新の状態を表示します", record: fresh ?? undefined, serverNow: serverNow() };
        }

        return { ok: true, record, serverNow: serverNow() };

    } catch( e ) {

        if( e instanceof TimerRuleError ) {
            const fresh = await getActiveTask( project_id ).catch( () => null );
            return { ok: false, message: e.message, record: fresh ?? undefined, serverNow: serverNow() };
        }

        console.error( "[onair] timerAction", errorMessage( e ) );
        return { ok: false, message: "操作に失敗しました", serverNow: serverNow() };

    }

}

/** 諦める: closes the timer (its time is kept on the record) and marks the record abandoned. */
export const abandonTask = async ( record_id: number, project_id: string ) => {

    const supabase = await createActionClient();

    await requireUser( supabase );

    const loaded = await loadOpenTimer( supabase, record_id, project_id );

    if( loaded ) {
        const closed = applyTimerEvent( loaded.timer, { type: "close" }, Date.now(), { overrunGraceMs: TIMER_BREAK_OVERRUN_GRACE_MS } );
        const saved = await saveTimer( supabase, loaded.row, closed, { status: "abandoned", ended_at: new Date().toISOString() } );
        if( !saved ) throw new Error( "The task changed in another tab, try again" );
    }

    redirect(`/project/${project_id}/dashboard`)

}

/**
 * Stops the timer for good (完成) and moves the record to 'reviewing'. No XP yet: the user writes
 * the task report first, then confirms the AI analysis on the report page, which awards the XP
 * (Reward Engine v1.0 + journey system, docs/journey-system.md). The focus time (records.duration)
 * comes from the server-side timer, never from the client.
 */
export const finishTask = async ( record_id: number, project_id: string ) => {

    const supabase = await createActionClient();

    const user = await requireUser( supabase );

    const loaded = await loadOpenTimer( supabase, record_id, project_id );

    if( !loaded ) {
        // a double click or a second tab: fine if it is already waiting for its report
        const { data: current } = await supabase.from( "records" ).select( "status" ).eq( "id", record_id ).eq( "project_id", project_id ).maybeSingle();
        if( current?.status !== "reviewing" ) throw new Error( "This task is not in progress" );
        redirect( `/project/${project_id}/task_report?recordId=${record_id}` );
    }

    const closed = applyTimerEvent( loaded.timer, { type: "close" }, Date.now(), { overrunGraceMs: TIMER_BREAK_OVERRUN_GRACE_MS } );

    const { data, error } = await supabase
        .from( "records" )
        .update( { status: "reviewing", timer: closed, duration: Math.max( 0, Math.round( closed.totals.workMs ) ), ended_at: new Date().toISOString() } )
        .eq( "id", record_id ).eq( "project_id", project_id ).eq( "updated_at", loaded.row.updated_at )
        .in( "status", [ "active", "paused" ] )
        .select( "id, node_id, nodes ( task_name, description, time_limit )" );

    if( error ) throw error.message;

    if( !data?.length ) {
        const { data: current } = await supabase.from( "records" ).select( "status" ).eq( "id", record_id ).eq( "project_id", project_id ).maybeSingle();
        if( current?.status !== "reviewing" ) throw new Error( "The task changed in another tab, try again" );
    }
    else {
        // the report's task snapshot (its estimate is what the reward uses); kept after 作業に戻る
        const row = data[0] as unknown as { node_id: string; nodes: JournalNodeSnapshot | JournalNodeSnapshot[] | null };
        const node = Array.isArray( row.nodes ) ? row.nodes[0] ?? null : row.nodes;
        await createJournalSnapshot( supabase, { recordId: record_id, projectId: project_id, userId: user.id, nodeId: row.node_id, node } );
    }

    redirect( `/project/${project_id}/task_report?recordId=${record_id}` )

}
