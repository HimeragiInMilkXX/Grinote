/**
 * Evidence of a task report: up to 3 photos / videos / audio files the AI looks at together with
 * the reflections (docs/journey-system.md). Client-safe: used by the upload UI and the server.
 *
 * Files live in the private bucket `journey_evidence` under {user_id}/{project_id}/{record_id}/.
 * `task_journals.evidence` holds the items below; the AI's per-item report is in
 * `analysis.evidence` (it stays when a file is deleted later).
 */

export const MAX_EVIDENCE = 3;

export type EvidenceKind = "image" | "video" | "audio";

const MB = 1024 * 1024;

/** Formats Gemini documents for image / video / audio understanding (also the bucket's allowed list). */
export const EVIDENCE_LIMITS: Record<EvidenceKind, { label: string; maxBytes: number; ext: readonly string[]; mimes: Record<string, string> }> = {
    image: {
        label: "写真",
        maxBytes: 10 * MB,
        ext: [ "jpg", "jpeg", "png", "webp", "heic", "heif" ],
        mimes: { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif" },
    },
    video: {
        label: "動画",
        maxBytes: 50 * MB,
        ext: [ "mp4", "mov", "webm", "mpeg", "mpg" ],
        mimes: { mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", mpeg: "video/mpeg", mpg: "video/mpeg" },
    },
    audio: {
        label: "音声",
        maxBytes: 25 * MB,
        ext: [ "mp3", "wav", "aac", "ogg", "flac", "aiff", "aif" ],
        mimes: { mp3: "audio/mpeg", wav: "audio/wav", aac: "audio/aac", ogg: "audio/ogg", flac: "audio/flac", aiff: "audio/aiff", aif: "audio/aiff" },
    },
};

export const EVIDENCE_KINDS = Object.keys( EVIDENCE_LIMITS ) as EvidenceKind[];

/** Recommended video / audio length (a hint only; longer files take longer to analyse). */
export const EVIDENCE_RECOMMENDED_MINUTES = 3;

/** Browser MIME aliases → the canonical type stored and sent to the model. */
const MIME_ALIASES: Record<string, string> = {
    "image/jpg": "image/jpeg",
    "image/pjpeg": "image/jpeg",
    "audio/mp3": "audio/mpeg",
    "audio/x-wav": "audio/wav",
    "audio/wave": "audio/wav",
    "audio/vnd.wave": "audio/wav",
    "audio/x-flac": "audio/flac",
    "audio/x-aiff": "audio/aiff",
    "audio/x-aac": "audio/aac",
    "audio/vorbis": "audio/ogg",
};

/** Every canonical MIME type that may be stored (matches the bucket's allowed_mime_types). */
export const EVIDENCE_MIME_TYPES: readonly string[] = [ ...new Set( EVIDENCE_KINDS.flatMap( k => Object.values( EVIDENCE_LIMITS[ k ].mimes ) ) ) ];

/** `accept` attribute of the file input. */
export const EVIDENCE_ACCEPT = [ ...EVIDENCE_MIME_TYPES, ...EVIDENCE_KINDS.flatMap( k => EVIDENCE_LIMITS[ k ].ext.map( e => `.${e}` ) ) ].join( "," );

export interface EvidenceItem {
    id: string;
    /** storage path in `journey_evidence` */
    path: string;
    kind: EvidenceKind;
    mime: string;
    name: string;
    size: number;
    uploadedAt: string;
}

/** An item with a short-lived signed URL for display (null when the file can't be read). */
export type EvidenceView = EvidenceItem & { url: string | null };

const extOf = ( name: string ) => {
    const i = name.lastIndexOf( "." );
    return i >= 0 ? name.slice( i + 1 ).toLowerCase() : "";
};

function kindOfMime( mime: string ): EvidenceKind | null {

    for( const kind of EVIDENCE_KINDS ) if( Object.values( EVIDENCE_LIMITS[ kind ].mimes ).includes( mime ) ) return kind;
    return null;

}

/** Kind, canonical MIME type and extension of a file (MIME first, then the extension). null = unsupported. */
export function detectEvidenceKind( file: { name: string; type?: string | null } ): { kind: EvidenceKind; mime: string; ext: string } | null {

    const raw = ( file.type ?? "" ).toLowerCase().split( ";" )[0].trim();
    const mime = MIME_ALIASES[ raw ] ?? raw;
    const ext = extOf( file.name );

    const byMime = kindOfMime( mime );

    if( byMime ) {
        const limits = EVIDENCE_LIMITS[ byMime ];
        // keep a matching extension, else derive one from the type
        const fileExt = limits.ext.includes( ext ) && limits.mimes[ ext ] === mime ? ext : Object.keys( limits.mimes ).find( e => limits.mimes[ e ] === mime )!;
        return { kind: byMime, mime, ext: fileExt };
    }

    // some browsers give "" or application/octet-stream (e.g. HEIC on Windows): trust a known extension
    if( raw === "" || raw === "application/octet-stream" ) {
        for( const kind of EVIDENCE_KINDS ) {
            const m = EVIDENCE_LIMITS[ kind ].mimes[ ext ];
            if( m ) return { kind, mime: m, ext };
        }
    }

    return null;

}

export const formatBytes = ( bytes: number ) => bytes >= MB ? `${( bytes / MB ).toFixed( bytes >= 10 * MB ? 0 : 1 )}MB` : `${Math.max( 1, Math.round( bytes / 1024 ) )}KB`;

export type EvidenceFileCheck =
    | { ok: true; kind: EvidenceKind; mime: string; ext: string }
    | { ok: false; error: string };

/** Format and size check of one file (same rules on the client and the server). */
export function validateEvidenceFile( file: { name: string; type?: string | null; size: number } ): EvidenceFileCheck {

    const detected = detectEvidenceKind( file );

    if( !detected ) return { ok: false, error: `「${file.name}」は対応していない形式です（写真・動画・音声のみ）。` };
    if( !( file.size > 0 ) ) return { ok: false, error: `「${file.name}」は空のファイルです。` };

    const limits = EVIDENCE_LIMITS[ detected.kind ];
    if( file.size > limits.maxBytes ) return { ok: false, error: `「${file.name}」は大きすぎます（${limits.label}は${formatBytes( limits.maxBytes )}まで、このファイルは${formatBytes( file.size )}）。` };

    return { ok: true, ...detected };

}

/** Folder of a record's evidence. Only this prefix is ever accepted for its items. */
export const evidenceFolder = ( userId: string, projectId: string, recordId: number ) => `${userId}/${projectId}/${recordId}`;

export const evidencePath = ( userId: string, projectId: string, recordId: number, id: string, ext: string ) => `${evidenceFolder( userId, projectId, recordId )}/${id}.${ext}`;

const ID = /^[0-9a-f-]{8,64}$/i;

export function isEvidencePathFor( path: string, userId: string, projectId: string, recordId: number ): boolean {

    const prefix = `${evidenceFolder( userId, projectId, recordId )}/`;
    if( !path.startsWith( prefix ) ) return false;

    const file = path.slice( prefix.length );
    return /^[0-9a-f-]{8,64}\.[a-z0-9]{2,5}$/i.test( file );

}

/** Narrow the stored jsonb (unknown shapes are dropped). */
export function asEvidenceItems( value: unknown ): EvidenceItem[] {

    if( !Array.isArray( value ) ) return [];

    return value.flatMap( ( v ): EvidenceItem[] => {

        if( !v || typeof v !== "object" ) return [];
        const e = v as Record<string, unknown>;

        if( typeof e.id !== "string" || !ID.test( e.id ) || typeof e.path !== "string" || !EVIDENCE_KINDS.includes( e.kind as EvidenceKind ) ) return [];

        return [ {
            id: e.id,
            path: e.path,
            kind: e.kind as EvidenceKind,
            mime: typeof e.mime === "string" ? e.mime : "",
            name: typeof e.name === "string" ? e.name : "",
            size: Number( e.size ) || 0,
            uploadedAt: typeof e.uploadedAt === "string" ? e.uploadedAt : "",
        } ];

    } );

}

/** A display name that fits the DB and the UI. */
export const cleanEvidenceName = ( name: string ) => name.replace( /[\u0000-\u001f]/g, "" ).trim().slice( 0, 120 ) || "file";

export const EVIDENCE_GUIDANCE = {
    summary: `写真・動画・音声を最大${MAX_EVIDENCE}件まで。AIが内容を確認して評価に使います。`,
    tips: [
        "作業した画面、ノート、手元、完成したものが分かるものがおすすめです。",
        `動画・音声は${EVIDENCE_RECOMMENDED_MINUTES}分以内がおすすめ（長いと分析に時間がかかります）。`,
        "個人情報や他人の顔が写らないように注意してください。",
    ],
    privacy: "分析のため、ファイルはクラウドAI（Google Gemini）に送信されます。保存されたファイルはレポート作成時の分析にだけ使われ、あとからジャーニーで削除できます。",
} as const;
