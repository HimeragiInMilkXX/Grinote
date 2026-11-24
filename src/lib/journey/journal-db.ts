import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { intervalToMinutes } from "@/lib/rewards/breakdown";
import { recoveredStatus, type TaskJournalRow } from "./journal";

export type JournalNodeSnapshot = { task_name: string; description: string | null; time_limit: string | null };

export async function loadJournal( supabase: SupabaseClient, recordId: number ): Promise<TaskJournalRow | null> {

    const { data, error } = await supabase.from( "task_journals" ).select( "*" ).eq( "record_id", recordId ).maybeSingle();

    if( error ) throw new Error( error.message );

    return data as TaskJournalRow | null;

}

/**
 * Creates the journal of a record that just went to 'reviewing', with the task snapshot taken now
 * (its estimate is what the reward uses). Does nothing if it exists already (after 作業に戻る).
 */
export async function createJournalSnapshot( supabase: SupabaseClient, args: { recordId: number; projectId: string; userId: string; nodeId: string; node: JournalNodeSnapshot | null } ): Promise<void> {

    const { error } = await supabase.from( "task_journals" ).upsert( {
        record_id: args.recordId,
        project_id: args.projectId,
        user_id: args.userId,
        node_id: args.nodeId,
        task_name: args.node?.task_name ?? "",
        task_description: args.node?.description ?? null,
        estimated_minutes: intervalToMinutes( args.node?.time_limit ),
    }, { onConflict: "record_id", ignoreDuplicates: true } );

    if( error ) throw new Error( error.message );

}

/** Update a journal only if nobody changed it since it was read (null = it changed). */
export async function updateJournal( supabase: SupabaseClient, row: TaskJournalRow, patch: Partial<TaskJournalRow> ): Promise<TaskJournalRow | null> {

    const { data, error } = await supabase
        .from( "task_journals" )
        .update( patch )
        .eq( "record_id", row.record_id )
        .eq( "updated_at", row.updated_at )
        .select( "*" );

    if( error ) throw new Error( error.message );

    return ( data?.[0] as TaskJournalRow | undefined ) ?? null;

}

/** Puts an interrupted 'analyzing' journal back to analyzed/failed so the user is never stuck. */
export async function recoverStaleJournal( supabase: SupabaseClient, row: TaskJournalRow | null ): Promise<TaskJournalRow | null> {

    if( !row ) return row;

    const status = recoveredStatus( row );
    if( !status ) return row;

    return ( await updateJournal( supabase, row, { analysis_status: status } ) ) ?? await loadJournal( supabase, row.record_id );

}
