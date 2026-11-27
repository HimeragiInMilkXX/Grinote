import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { uploadFile, type FilePart } from "ai";
import { DEFAULT_MODEL } from "@/lib/ai/models";
import { getGoogleFiles, hasGeminiKey, isGoogleModel } from "@/lib/ai/provider";
import { errorMessage } from "@/utils/utils";
import { EVIDENCE_BUCKET } from "./evidence-db";
import type { EvidenceItem } from "./evidence";

/** Gemini processes uploaded videos before they can be used; give up after this. */
const PROCESSING_TIMEOUT_MS = 120_000;

/**
 * Model that looks at evidence files: `JOURNEY_EVIDENCE_MODEL` or the default Gemini model.
 * Only Gemini takes photos, video and audio here (the local models go through the
 * OpenAI-compatible API, which has no video/audio input), so this is null without a key.
 */
export function getEvidenceModelId(): string | null {

    const id = process.env.JOURNEY_EVIDENCE_MODEL?.trim() || DEFAULT_MODEL;

    return isGoogleModel( id ) && hasGeminiKey() ? id : null;

}

export const isEvidenceAnalysisAvailable = () => getEvidenceModelId() !== null;

export interface PreparedEvidence {
    item: EvidenceItem;
    /** null: the file couldn't be read or uploaded (the model is told it wasn't given) */
    part: FilePart | null;
}

/** Reads each file from storage and uploads it to the Gemini Files API (in parallel; failures are per file). */
export async function prepareEvidenceParts( supabase: SupabaseClient, items: readonly EvidenceItem[], abortSignal?: AbortSignal ): Promise<PreparedEvidence[]> {

    const files = getGoogleFiles();

    return Promise.all( items.map( async ( item ): Promise<PreparedEvidence> => {

        try {

            const { data, error } = await supabase.storage.from( EVIDENCE_BUCKET ).download( item.path );
            if( error || !data ) throw new Error( error?.message ?? "file not found" );

            const bytes = new Uint8Array( await data.arrayBuffer() );

            const uploaded = await uploadFile( {
                api: files,
                data: bytes,
                mediaType: item.mime,
                abortSignal,
                providerOptions: { google: { displayName: `evidence-${item.id}`, pollTimeoutMs: PROCESSING_TIMEOUT_MS } },
            } );

            return { item, part: { type: "file", data: { type: "reference", reference: uploaded.providerReference }, mediaType: item.mime } };

        } catch( e ) {

            console.warn( "[journey] evidence upload failed", { id: item.id, kind: item.kind, error: errorMessage( e ) } );
            return { item, part: null };

        }

    } ) );

}
