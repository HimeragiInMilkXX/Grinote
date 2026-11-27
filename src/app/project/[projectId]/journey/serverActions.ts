"use server";

import { revalidatePath } from "next/cache";
import { getProject } from "@/lib/projects";
import { asEvidenceItems, isEvidencePathFor, type EvidenceView } from "@/lib/journey/evidence";
import { removeEvidenceFiles, withSignedUrls } from "@/lib/journey/evidence-db";
import { computeJourneyStats, loadJourneyEntries, type JourneyEntry, type JourneyStats } from "@/lib/journey/history";
import { loadJournal, updateJournal } from "@/lib/journey/journal-db";
import { normalizeWorkDays } from "@/lib/projects/work-days";
import { createActionClient } from "@/utils/supabase/actions";
import { createClient, requireUser } from "@/utils/supabase/server";
import { errorMessage } from "@/utils/utils";

/** A journey entry with its uploaded files (signed URLs for display). */
export type JourneyEntryView = JourneyEntry & { evidence: EvidenceView[] };

export interface JourneyData {
    stats: JourneyStats;
    entries: JourneyEntryView[];
    /** record id of a finished task whose report is still pending */
    pendingReportId: number | null;
}

export const getJourney = async ( projectId: string ): Promise<JourneyData> => {

    // ownership check (redirects to /login without a user)
    const project: Project = await getProject( projectId );

    const supabase = await createClient();

    const [ entries, pending ] = await Promise.all( [
        loadJourneyEntries( supabase, projectId ),
        supabase.from( "records" ).select( "id" ).eq( "project_id", projectId ).eq( "status", "reviewing" ).limit( 1 ),
    ] );

    if( pending.error ) throw new Error( pending.error.message );

    // one signing call for every file on the page
    const signed = await withSignedUrls( supabase, entries.flatMap( e => e.journal?.evidence ?? [] ) );
    const byId = new Map( signed.map( v => [ v.id, v ] ) );

    return {
        stats: computeJourneyStats( entries, { created_at: new Date( project.created_at ).toISOString(), work_days: normalizeWorkDays( project.work_days ) } ),
        entries: entries.map( e => ( { ...e, evidence: ( e.journal?.evidence ?? [] ).map( item => byId.get( item.id ) ?? { ...item, url: null } ) } ) ),
        pendingReportId: pending.data?.[0]?.id ?? null,
    };

};

/**
 * Deletes an uploaded file of a completed task. Allowed after confirmation: the media are no
 * longer used, only the AI's analysis of them (which stays). The DB guard lets a confirmed
 * journal lose evidence items and nothing else.
 */
export const deleteJourneyEvidence = async ( recordId: number, projectId: string, evidenceId: string ): Promise<{ ok: true } | { ok: false; message: string }> => {

    try {

        const supabase = await createActionClient();
        const user = await requireUser( supabase );

        const { data: record, error } = await supabase
            .from( "records" ).select( "id, status" )
            .eq( "id", recordId ).eq( "project_id", projectId ).eq( "user_id", user.id )
            .maybeSingle();

        if( error ) throw new Error( error.message );
        if( !record || record.status !== "completed" ) return { ok: false, message: "この記録の証拠は削除できません。" };

        const journal = await loadJournal( supabase, recordId );
        if( !journal ) return { ok: false, message: "この記録の証拠は削除できません。" };

        const items = asEvidenceItems( journal.evidence );
        const target = items.find( e => e.id === evidenceId );

        if( target ) {

            // the raw jsonb is filtered (not re-serialised), so the remaining items stay byte-for-byte equal for the guard
            const remaining = ( Array.isArray( journal.evidence ) ? journal.evidence : [] ).filter( e => !( e && typeof e === "object" && ( e as { id?: unknown } ).id === evidenceId ) );

            const updated = await updateJournal( supabase, journal, { evidence: remaining } );
            if( !updated ) return { ok: false, message: "別の画面で記録が更新されました。ページを再読み込みしてください。" };

            if( isEvidencePathFor( target.path, user.id, projectId, recordId ) ) await removeEvidenceFiles( supabase, [ target.path ] );

        }

        revalidatePath( `/project/${projectId}/journey` );

        return { ok: true };

    } catch( e ) {

        console.error( "[journey] deleteJourneyEvidence", errorMessage( e ) );
        return { ok: false, message: "証拠を削除できませんでした。もう一度お試しください。" };

    }

};
