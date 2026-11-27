"use server";

/**
 * Server actions of the user-defined schedule (docs/schedule.md). Used by the schedule page and
 * by the assistant's proposal card. Every change is re-validated here on fresh data with the same
 * `normalizeScheduleOps` the client and the AI tool use; the DB trigger is the last safety net.
 */

import { createActionClient } from "@/utils/supabase/actions";
import { requireUser } from "@/utils/supabase/server";
import { describeScheduleError } from "./errors";
import { loadScheduleView, type ScheduleView } from "./data";
import { normalizeScheduleOps, ScheduleOpsError, type RawScheduleOps } from "./normalize";

export type ScheduleActionResult =
    | { ok: true; view: ScheduleView; warnings: string[] }
    | { ok: false; message: string; problems?: string[]; view?: ScheduleView };

const NOT_FOUND = "プロジェクトが見つかりません。";

async function session( projectId: string ) {

    const supabase = await createActionClient();
    await requireUser( supabase );
    const view = await loadScheduleView( supabase, projectId );

    return { supabase, view };

}

export async function getScheduleView( projectId: string ): Promise<ScheduleActionResult> {

    try {

        const { view } = await session( projectId );
        if( !view ) return { ok: false, message: NOT_FOUND };

        return { ok: true, view, warnings: [] };

    } catch( e ) {

        console.error( "[schedule] getScheduleView", e instanceof Error ? e.message : e );
        return { ok: false, message: describeScheduleError( e ) };

    }

}

/**
 * Apply a batch of add / move / remove operations. Removes run first (they free capacity), then
 * moves, then inserts. Each step only touches open entries of this project.
 */
export async function applyScheduleChanges( projectId: string, raw: RawScheduleOps ): Promise<ScheduleActionResult> {

    let view: ScheduleView | null = null;

    try {

        const s = await session( projectId );
        view = s.view;
        if( !view ) return { ok: false, message: NOT_FOUND };

        const { ops, warnings } = normalizeScheduleOps( raw, {
            todayKey: view.todayKey,
            goalKey: view.goalKey,
            workDays: view.workDays,
            goalMinutes: view.goalMinutes,
            nodes: view.nodes,
            items: view.items,
        } );

        const { supabase } = s;

        if( ops.remove.length > 0 ) {
            const ids = ops.remove.map( r => r.item_id );
            const { data, error } = await supabase
                .from( "schedule_items" ).delete()
                .eq( "project_id", projectId ).in( "id", ids ).is( "done_at", null )
                .select( "id" );
            if( error ) throw error;
            if( ( data ?? [] ).length !== ids.length ) throw new Error( "schedule_done_locked" );
        }

        for( const m of ops.move ) {
            const { data, error } = await supabase
                .from( "schedule_items" ).update( { scheduled_for: m.date } )
                .eq( "project_id", projectId ).eq( "id", m.item_id ).is( "done_at", null )
                .select( "id" );
            if( error ) throw error;
            if( ( data ?? [] ).length !== 1 ) throw new Error( "schedule_done_locked" );
        }

        // one insert per row: the guard trigger checks the limit row by row
        for( const a of ops.add ) {
            for( let i = 0; i < a.count; i++ ) {
                const { error } = await supabase.from( "schedule_items" ).insert( { project_id: projectId, node_id: a.node_id, scheduled_for: a.date } );
                if( error ) throw error;
            }
        }

        const fresh = await loadScheduleView( supabase, projectId );
        if( !fresh ) return { ok: false, message: NOT_FOUND };

        return { ok: true, view: fresh, warnings };

    } catch( e ) {

        if( e instanceof ScheduleOpsError ) {
            return { ok: false, message: "予定を変更できませんでした。", problems: e.problems, view: view ?? undefined };
        }

        console.error( "[schedule] applyScheduleChanges", e instanceof Error ? e.message : e );

        // a step may have been written before the failure: hand back the current state
        let current: ScheduleView | undefined;
        try {
            const supabase = await createActionClient();
            current = ( await loadScheduleView( supabase, projectId ) ) ?? undefined;
        } catch { /* keep the error message */ }

        return { ok: false, message: describeScheduleError( e ), view: current };

    }

}
