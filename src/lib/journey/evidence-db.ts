import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { errorMessage } from "@/utils/utils";
import { evidenceFolder, type EvidenceItem, type EvidenceView } from "./evidence";

/** Private bucket of task report evidence (supabase/migrations/20261130000001_journey_evidence.sql). */
export const EVIDENCE_BUCKET = "journey_evidence";

const SIGNED_URL_TTL_S = 60 * 60;

/** Short-lived URLs for display (an unreadable file gets `url: null`). */
export async function withSignedUrls( supabase: SupabaseClient, items: readonly EvidenceItem[] ): Promise<EvidenceView[]> {

    if( items.length === 0 ) return [];

    const { data, error } = await supabase.storage.from( EVIDENCE_BUCKET ).createSignedUrls( items.map( i => i.path ), SIGNED_URL_TTL_S );

    if( error ) console.warn( "[evidence] signed urls", error.message );

    const byPath = new Map( ( data ?? [] ).filter( d => !d.error && d.signedUrl ).map( d => [ d.path, d.signedUrl ] ) );

    return items.map( i => ( { ...i, url: byPath.get( i.path ) ?? null } ) );

}

/** Removes files (best-effort: a leftover private file is only wasted space). */
export async function removeEvidenceFiles( supabase: SupabaseClient, paths: readonly string[] ): Promise<void> {

    for( let i = 0; i < paths.length; i += 100 ) {

        const { error } = await supabase.storage.from( EVIDENCE_BUCKET ).remove( paths.slice( i, i + 100 ) );
        if( error ) console.warn( "[evidence] remove", error.message );

    }

}

async function listFolder( supabase: SupabaseClient, folder: string ) {

    const out: { name: string; isFolder: boolean }[] = [];

    for( let offset = 0; ; offset += 1000 ) {

        const { data, error } = await supabase.storage.from( EVIDENCE_BUCKET ).list( folder, { limit: 1000, offset } );
        if( error ) throw new Error( error.message );

        // folders come back with id === null
        for( const item of data ?? [] ) out.push( { name: item.name, isFolder: !item.id } );

        if( !data || data.length < 1000 ) break;

    }

    return out;

}

/** Every evidence file of the given records (also files never registered in a journal). */
export async function removeRecordsEvidence( supabase: SupabaseClient, userId: string, projectId: string, recordIds: readonly number[] ): Promise<void> {

    try {

        const paths: string[] = [];

        for( const recordId of recordIds ) {
            const folder = evidenceFolder( userId, projectId, recordId );
            for( const f of await listFolder( supabase, folder ) ) if( !f.isFolder ) paths.push( `${folder}/${f.name}` );
        }

        await removeEvidenceFiles( supabase, paths );

    } catch( e ) {

        console.warn( "[evidence] removeRecordsEvidence", errorMessage( e ) );

    }

}

/** Every evidence file of a project (before a reset or delete removes its records). */
export async function removeProjectEvidence( supabase: SupabaseClient, userId: string, projectId: string ): Promise<void> {

    const root = `${userId}/${projectId}`;

    const folders = ( await listFolder( supabase, root ) ).filter( f => f.isFolder ).map( f => Number( f.name ) ).filter( Number.isInteger );

    await removeRecordsEvidence( supabase, userId, projectId, folders );

}
