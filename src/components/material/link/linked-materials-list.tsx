"use client"

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { MaterialSummary, materialTypeCaptions } from "@/types/materials"
import { FileText, Heart, Pin } from "lucide-react"
import { useState } from "react"
import MaterialViewer from "../material-viewer"
import { useAtomValue } from "jotai"
import { memoUnsavedAtom } from "@/atoms/material_atoms"
import { UNSAVED_MEMO_CONFIRM } from "../memo/use-unsaved-memo"

/** Clickable list of materials; clicking opens the material (with its memo) in a right-side sheet without leaving the page. */
const LinkedMaterialsList = ( { project_id, materials, emptyText = "リンクされたマテリアルはありません" }: { project_id: string, materials: MaterialSummary[], emptyText?: string } ) => {

    const [ openId, setOpenId ] = useState<number | null>( null );
    const unsavedMemoIds = useAtomValue( memoUnsavedAtom );

    const closeSheet = () => {
        if( openId !== null && unsavedMemoIds.includes( openId ) && !window.confirm( UNSAVED_MEMO_CONFIRM ) ) return;
        setOpenId( null );
    }

    return (
        <>
            { materials.length === 0
                ? <p className="text-sm text-muted-foreground"> { emptyText } </p>
                : (
                    <ul className="flex flex-col gap-1">
                        { materials.map( m => (
                            <li key={m.id}>
                                <button type="button" onClick={() => setOpenId( m.id )}
                                    className="w-full flex items-center gap-2 text-left text-sm px-2 py-1.5 rounded hover:bg-muted cursor-pointer">
                                    <FileText size={14} className="shrink-0" style={{ color: m.color }}/>
                                    <span className="truncate grow"> { m.name } </span>
                                    { m.pinned_at && <Pin size={12} className="fill-blue-500 text-blue-500 shrink-0"/> }
                                    { m.is_favourite && <Heart size={12} className="fill-red-500 text-red-500 shrink-0"/> }
                                    <span className="text-xs text-muted-foreground shrink-0"> { materialTypeCaptions[m.type] } </span>
                                </button>
                            </li>
                        ) ) }
                    </ul>
                ) }
            <Sheet open={openId !== null} onOpenChange={open => { if( !open ) closeSheet() }}>
                <SheetContent side="right" className="w-[min(900px,95vw)]! max-w-none! sm:max-w-none! overflow-y-auto p-6">
                    <SheetHeader className="sr-only"><SheetTitle> マテリアル </SheetTitle></SheetHeader>
                    { openId !== null && <MaterialViewer project_id={project_id} material_id={openId} memoHeightClass="h-[40vh]" /> }
                </SheetContent>
            </Sheet>
        </>
    )

}

export default LinkedMaterialsList
