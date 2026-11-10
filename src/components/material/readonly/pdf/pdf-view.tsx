"use client"

import { useState, useRef, useEffect } from "react";
import PdfEditor, { PdfEditorHandle } from "@/components/material/readonly/pdf/pdf-editor";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Download, Save } from "lucide-react";
import { toast } from "sonner";

const PdfView = ( { src, className = "" }: { src: string, className?: string } ) => {

    const pdfEditorRef = useRef<PdfEditorHandle>(null);

    const [ isSaving, setIsSaving ] = useState(false);

    const [ savedOnce, setSavedOnce ] = useState(false);

    useEffect( () => {

        if( !savedOnce || isSaving ) return;

        toast.success("保存は成功しました。リフレッシュすると変更はまだ反映されていない可能性があるのでご了承ください。", { position: "top-left" })

    }, [ isSaving ])

    return (

        <>
            <div className="w-full flex justify-between px-3 items-center sticky top-0 z-2 bg-white py-6 border-b">
                <h3 className="text-2xl"> マテリアル名 </h3>
                <div className={cn( "flex gap-3 items-center", isSaving && 'opacity-80 pointer-events-none' )}>

                    <Button className="bg-blue-300! hover:bg-blue-400! cursor-pointer py-3 px-4.5 flex items-center leading-tight" variant="ghost" onClick={() => pdfEditorRef.current?.handleDownload()}> ダウンロード <Download/> </Button>
                    <Button className="bg-green-300! hover:bg-green-400! cursor-pointer py-3 px-4.5 flex items-center leading-tight" variant="ghost"
                        onClick={ async () => {
                            await pdfEditorRef.current?.handleSave();
                            setSavedOnce(true);
                        }}> 保存 <Save/> </Button>

                </div>
            </div>
            <div className={cn( className, "flex flex-col gap-3 w-full relative")}>
                <PdfEditor ref={pdfEditorRef} src={src} onSavingChange={setIsSaving} className="min-h-100"/>
            </div>
        </>

    )

}

export default PdfView
