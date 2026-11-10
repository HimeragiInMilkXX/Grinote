"use client"

import { Button } from "@/components/ui/button"
import { cn } from "cn"
import { Material } from "@/types/materials"
import { updateHTMLContent } from "@/app/project/[projectId]/materials/serverActions"
import RichTextEditor, { EditorRef } from "@/components/richTextEditor/RichTextEditor"
import { useRef } from "react"
import { Save } from "lucide-react"

const MemoView = ( { className = "", material }: { className?: string, material: Material } ) => {

    const editorRef = useRef<EditorRef | null>(null);

    return (

        <>
            <div className="w-full flex justify-between px-3 items-center sticky top-0 z-2 bg-white py-6 border-b">
                <h3 className="text-2xl"> { material.name } </h3>
                <Button className="py-3 px-4.5 bg-blue-300 hover:bg-blue-400 flex items-center" onClick={() => updateHTMLContent( material.project_id, material.id, editorRef.current?.getHTML(), editorRef.current?.getAllImageUrls() )}> Save <Save/> </Button>
            </div>
            <div className={cn( className, "flex flex-col gap-3 w-full" )}>
                <RichTextEditor ref={editorRef} classes="mt-3 mb-6" content={material?.content ?? ""}/>
            </div>
        </>

    )

}

export default MemoView
