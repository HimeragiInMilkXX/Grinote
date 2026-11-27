"use client"

import { deleteJourneyEvidence } from "@/app/project/[projectId]/journey/serverActions";
import EvidenceGallery from "@/components/project/evidence/evidence-gallery";
import type { EvidenceReport } from "@/lib/journey/analysis";
import type { EvidenceView } from "@/lib/journey/evidence";
import { FileUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
    projectId: string;
    recordId: number;
    items: EvidenceView[];
    reports?: EvidenceReport[];
};

/** The 証拠 block of a journey entry: media + per-file AI report; files can be deleted (the report stays). */
const JourneyEvidence = ( { projectId, recordId, items: initial, reports }: Props ) => {

    const router = useRouter();
    const [ items, setItems ] = useState( initial );
    const [ deletingId, setDeletingId ] = useState<string | null>( null );
    const [ error, setError ] = useState<string | null>( null );

    if( items.length === 0 && !reports?.length ) {
        return <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><FileUp className="size-4"/> 証拠なし </p>;
    }

    const onDelete = async ( id: string ) => {

        const item = items.find( e => e.id === id );
        if( !window.confirm( `「${item?.name ?? "このファイル"}」を削除しますか？\nファイルは元に戻せませんが、AIの分析結果は残ります。` ) ) return;

        setDeletingId( id );
        setError( null );

        try {
            const res = await deleteJourneyEvidence( recordId, projectId, id );
            if( res.ok ) {
                setItems( list => list.filter( e => e.id !== id ) );
                router.refresh();
            }
            else setError( res.message );
        } catch {
            setError( "通信エラーが発生しました。もう一度お試しください。" );
        } finally {
            setDeletingId( null );
        }

    };

    return (
        <div className="flex flex-col gap-2">
            <EvidenceGallery items={items} reports={reports} onDelete={onDelete} deletingId={deletingId}/>
            { error && <p className="text-sm text-destructive">{ error }</p> }
            <p className="text-[11px] text-muted-foreground"> 証拠のファイルはレポート作成時の分析にだけ使われました。不要になったファイルは削除できます（AIの分析結果は残ります）。 </p>
        </div>
    );

};

export default JourneyEvidence;
