"use client"

import { Button } from "@/components/ui/button"
import { cn } from "cn"
import { Material } from "@/types/materials"
import { updateHTMLContent } from "@/app/project/[projectId]/materials/serverActions"
import RichTextEditor, { EditorRef } from "@/components/richTextEditor/RichTextEditor"
import { useRef, useState } from "react"
import { Save } from "lucide-react"
import { toast } from "sonner"
import { useMemoDraft } from "./use-memo-draft"
import { useUnsavedMemo } from "./use-unsaved-memo"

const MemoView = ( { className = "", material, title, heightClass }: { className?: string, material: Material, title?: React.ReactNode, heightClass?: string } ) => {

    const editorRef = useRef<EditorRef | null>(null);
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

        <>
            <div className="w-full flex justify-between px-3 items-center sticky top-0 z-2 bg-white py-6 border-b gap-3">
                { title ?? <h3 className="text-2xl"> { material.name } </h3> }
                <div className="flex items-center gap-3 shrink-0">
                    { dirty && <p className="text-sm text-red-600"> 保存されていない変更がある </p> }
                    <Button className="py-3 px-4.5 bg-blue-300 hover:bg-blue-400 flex items-center" onClick={save} disabled={saving}> Save <Save/> </Button>
                </div>
            </div>
            <div className={cn( className, "flex flex-col gap-3 w-full" )}>
                <RichTextEditor ref={editorRef} material_id={material.id} heightClass={heightClass} classes="mt-3 mb-6" content={material.content ?? ""} onChange={markDirty}/>
            </div>
        </>

    )

}

export default MemoView
