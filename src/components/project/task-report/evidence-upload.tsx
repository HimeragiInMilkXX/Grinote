"use client"

import { EVIDENCE_ACCEPT, EVIDENCE_GUIDANCE, EVIDENCE_KINDS, EVIDENCE_LIMITS, formatBytes, MAX_EVIDENCE } from "@/lib/journey/evidence";
import { cn } from "@/lib/utils";
import { FileUp, Info, Loader2 } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";

type Props = {
    count: number;
    /** names of the files being uploaded right now */
    uploading: readonly string[];
    disabled?: boolean;
    /** why uploading is off (shown instead of the drop zone) */
    disabledReason?: string | null;
    onFiles: ( files: File[] ) => void;
};

/** Drop zone + guidance (formats, sizes, tips, privacy) for the report evidence. */
const EvidenceUpload = ( { count, uploading, disabled = false, disabledReason = null, onFiles }: Props ) => {

    const input = useRef<HTMLInputElement>( null );
    const [ dragging, setDragging ] = useState( false );

    const remaining = Math.max( 0, MAX_EVIDENCE - count - uploading.length );
    const off = disabled || !!disabledReason || remaining === 0;

    const pick = ( list: FileList | null ) => {
        const files = Array.from( list ?? [] );
        if( files.length ) onFiles( files );
    };

    const onDrop = ( e: DragEvent ) => {
        e.preventDefault();
        setDragging( false );
        if( !off ) pick( e.dataTransfer.files );
    };

    return (
        <div className="flex flex-col gap-3">

            { disabledReason ? (
                <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground"> { disabledReason } </p>
            ) : (
                <button
                    type="button"
                    disabled={off}
                    onClick={() => input.current?.click()}
                    onDragOver={e => { e.preventDefault(); if( !off ) setDragging( true ); }}
                    onDragLeave={() => setDragging( false )}
                    onDrop={onDrop}
                    className={cn(
                        "flex w-full flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-6 text-center text-sm transition-colors",
                        off ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-primary/60 hover:bg-primary/5",
                        dragging && "border-primary bg-primary/10",
                    )}
                >
                    <FileUp className="size-6 text-muted-foreground"/>
                    <span className="font-medium">
                        { remaining === 0 && uploading.length === 0 ? `上限の${MAX_EVIDENCE}件に達しました` : "クリックまたはドラッグ＆ドロップでファイルを追加" }
                    </span>
                    <span className="text-xs text-muted-foreground"> あと{ remaining }件追加できます（最大{ MAX_EVIDENCE }件） </span>
                </button>
            ) }

            <input
                ref={input}
                type="file"
                multiple
                accept={EVIDENCE_ACCEPT}
                className="hidden"
                onChange={e => { pick( e.target.files ); e.target.value = ""; }}
            />

            { uploading.length > 0 && (
                <ul className="flex flex-col gap-1 text-sm" role="status">
                    { uploading.map( ( name, i ) => (
                        <li key={`${name}-${i}`} className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin"/> { name } をアップロード中… </li>
                    ) ) }
                </ul>
            ) }

            <div className="flex flex-col gap-2 rounded-xl bg-muted/60 px-4 py-3 text-xs text-muted-foreground">
                <p className="flex items-center gap-1 font-semibold text-foreground/80"><Info className="size-3.5"/> アップロードできるファイル </p>
                <ul className="grid gap-1 sm:grid-cols-3">
                    { EVIDENCE_KINDS.map( kind => {
                        const l = EVIDENCE_LIMITS[ kind ];
                        return (
                            <li key={kind}>
                                <span className="font-medium text-foreground/80">{ l.label }</span>：{ [ ...new Set( l.ext.map( e => e.toUpperCase() ) ) ].join( "・" ) }（{ formatBytes( l.maxBytes ) }まで）
                            </li>
                        );
                    } ) }
                </ul>
                <ul className="list-disc pl-4">
                    { EVIDENCE_GUIDANCE.tips.map( tip => <li key={tip}>{ tip }</li> ) }
                </ul>
                <p>{ EVIDENCE_GUIDANCE.privacy }</p>
            </div>

        </div>
    );

};

export default EvidenceUpload;
