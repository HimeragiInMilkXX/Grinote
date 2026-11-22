"use client"

import { updateHTMLContent } from "@/app/project/[projectId]/materials/serverActions"
import RichTextEditor, { EditorRef } from "@/components/richTextEditor/RichTextEditor"
import { Button } from "@/components/ui/button"
import { Material } from "@/types/materials"
import { NotebookPen, Save } from "lucide-react"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { useMemoDraft } from "./use-memo-draft"
import { useUnsavedMemo } from "./use-unsaved-memo"

/** Memo editor shown under every non-memo material (its `content` column). */
const MemoSection = ( { material, heightClass = "h-[45vh]" }: { material: Material, heightClass?: string } ) => {

    const editorRef = useRef<EditorRef | null>( null );
    const [ saving, setSaving ] = useState( false );

    const { dirty, markDirty, markSaved } = useUnsavedMemo( material.id );

    useMemoDraft( material.id, editorRef );

    const save = async () => {

        if( !editorRef.current ) return;

        setSaving( true );

        try {
            await updateHTMLContent( material.project_id, material.id, editorRef.current.getHTML(), editorRef.current.getAllImageUrls() );
            markSaved();
            toast.success( "メモを保存しました" );
        } catch( e ) {
            toast.error( String( e ) );
        } finally {
            setSaving( false );
        }

    }

    return (
        <section className="flex flex-col gap-3 border-t pt-6 mt-3">
            <div className="flex justify-between items-center px-3 gap-3">
                <h4 className="text-xl flex items-center gap-2"> <NotebookPen size={20}/> メモ </h4>
                <div className="flex items-center gap-3">
                    { dirty && <p className="text-sm text-red-600"> 保存されていない変更がある </p> }
                    <Button className="py-3 px-4.5 bg-blue-300 hover:bg-blue-400 flex items-center" onClick={save} disabled={saving}> 保存 <Save/> </Button>
                </div>
            </div>
            <RichTextEditor ref={editorRef} material_id={material.id} heightClass={heightClass} content={material.content ?? ""} onChange={markDirty}/>
        </section>
    )

}

export default MemoSection
