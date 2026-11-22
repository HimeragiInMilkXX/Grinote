"use client"

import { memoDraftRequestAtom } from "@/atoms/material_atoms";
import { EditorRef } from "@/components/richTextEditor/RichTextEditor";
import { useAtom } from "jotai";
import { RefObject, useEffect } from "react";
import { toast } from "sonner";

/** Writes a pending AI memo draft for this material into the editor once it is ready. The draft is not saved. */
export const useMemoDraft = ( material_id: number, editorRef: RefObject<EditorRef | null> ) => {

    const [ request, setRequest ] = useAtom( memoDraftRequestAtom );

    useEffect( () => {

        if( !request || request.material_id !== material_id ) return;

        let tries = 0;

        const timer = setInterval( () => {

            tries++;

            const editor = editorRef.current;

            if( editor?.isReady() ) {

                clearInterval( timer );

                if( request.mode === "replace" ) editor.setHTML( request.html );
                else editor.appendHTML( request.html );

                setRequest( null );

                toast.info( "AIの下書きをメモに挿入しました。内容を確認して保存してください。" );

            } else if( tries > 50 ) clearInterval( timer );

        }, 100 );

        return () => clearInterval( timer );

    }, [ request, material_id, editorRef, setRequest ] );

}
