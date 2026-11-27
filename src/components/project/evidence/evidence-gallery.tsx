"use client"

import { Button } from "@/components/ui/button";
import type { EvidenceReport } from "@/lib/journey/analysis";
import { EVIDENCE_LIMITS, formatBytes, type EvidenceKind, type EvidenceView } from "@/lib/journey/evidence";
import { AudioLines, Bot, Eye, ImageIcon, Loader2, Trash2, Video } from "lucide-react";
import type { ReactNode } from "react";

const KIND_ICON: Record<EvidenceKind, ReactNode> = {
    image: <ImageIcon className="size-4"/>,
    video: <Video className="size-4"/>,
    audio: <AudioLines className="size-4"/>,
};

type Row = { id: string; kind: EvidenceKind; name: string; media: EvidenceView | null; report: EvidenceReport | null };

/** Media of the report in analysis order, then files the analysis didn't include. */
function toRows( items: readonly EvidenceView[], reports: readonly EvidenceReport[] | undefined ): Row[] {

    const media = new Map( items.map( i => [ i.id, i ] ) );
    const rows: Row[] = ( reports ?? [] ).map( r => ( { id: r.id, kind: r.kind, name: r.name, media: media.get( r.id ) ?? null, report: r } ) );
    const seen = new Set( rows.map( r => r.id ) );

    for( const item of items ) if( !seen.has( item.id ) ) rows.push( { id: item.id, kind: item.kind, name: item.name, media: item, report: null } );

    return rows;

}

function Media( { row }: { row: Row } ) {

    if( !row.media ) return <div className="flex h-20 items-center justify-center rounded-xl bg-muted px-3 text-center text-xs text-muted-foreground"> メディアは削除済みです（AIの分析は残っています） </div>;

    const { url, kind, name } = row.media;

    if( !url ) return <div className="flex h-20 items-center justify-center rounded-xl bg-muted px-3 text-xs text-muted-foreground"> ファイルを読み込めませんでした </div>;

    if( kind === "image" ) return (
        <a href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl bg-muted">
            {/* signed URL of a private file: next/image can't optimise it */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={name} className="mx-auto max-h-72 w-auto object-contain"/>
        </a>
    );

    if( kind === "video" ) return <video src={url} controls preload="metadata" className="max-h-72 w-full rounded-xl bg-black"/>;

    return <audio src={url} controls preload="metadata" className="w-full"/>;

}

function Report( { row, pendingLabel }: { row: Row; pendingLabel: string | null } ) {

    const r = row.report;

    if( !r ) return pendingLabel ? <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-amber-700 dark:text-amber-400"> { pendingLabel } </p> : null;

    if( !r.analyzed ) return <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground"> AIはこのファイルを確認できませんでした（振り返りのみで評価しました）。 </p>;

    return (
        <div className="flex flex-col gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm">
            <div>
                <p className="flex items-center gap-1 text-xs font-semibold text-muted-foreground"><Eye className="size-3.5"/> AIが見た・聞いたこと </p>
                <p className="whitespace-pre-wrap leading-relaxed">{ r.observed }</p>
            </div>
            { r.assessment && (
                <div>
                    <p className="flex items-center gap-1 text-xs font-semibold text-muted-foreground"><Bot className="size-3.5"/> 分析 </p>
                    <p className="whitespace-pre-wrap leading-relaxed">{ r.assessment }</p>
                </div>
            ) }
        </div>
    );

}

type Props = {
    items: readonly EvidenceView[];
    /** `analysis.evidence` of the report (per-file AI reports) */
    reports?: readonly EvidenceReport[];
    /** text for files without a report (e.g. uploaded after the analysis); null = say nothing */
    pendingLabel?: string | null;
    onDelete?: ( id: string ) => void;
    deletingId?: string | null;
    disabled?: boolean;
};

/** Uploaded evidence with the AI's report on each file (report page + journey). */
const EvidenceGallery = ( { items, reports, pendingLabel = null, onDelete, deletingId = null, disabled = false }: Props ) => {

    const rows = toRows( items, reports );

    if( rows.length === 0 ) return null;

    return (
        <ul className="grid gap-3 sm:grid-cols-2">
            { rows.map( ( row, i ) => (
                <li key={row.id} className="flex min-w-0 flex-col gap-2 rounded-2xl border p-3">
                    <div className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                            { KIND_ICON[ row.kind ] }
                            <span className="shrink-0 text-xs text-muted-foreground">証拠{ i + 1 }・{ EVIDENCE_LIMITS[ row.kind ].label }</span>
                            <span className="truncate" title={row.name}>{ row.name }</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                            { row.media && <span className="text-xs tabular-nums text-muted-foreground">{ formatBytes( row.media.size ) }</span> }
                            { onDelete && row.media && (
                                <Button
                                    variant="ghost" size="icon-sm" aria-label={`${row.name} を削除`} title="削除"
                                    disabled={disabled || deletingId !== null}
                                    onClick={() => onDelete( row.id )}
                                >
                                    { deletingId === row.id ? <Loader2 className="animate-spin"/> : <Trash2/> }
                                </Button>
                            ) }
                        </span>
                    </div>
                    <Media row={row}/>
                    <Report row={row} pendingLabel={pendingLabel}/>
                </li>
            ) ) }
        </ul>
    );

};

export default EvidenceGallery;
