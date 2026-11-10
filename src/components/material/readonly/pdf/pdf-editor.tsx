"use client"

import { useState, useRef, useImperativeHandle, RefObject, useEffect } from "react";
import {
    PDFViewer,
    PDFViewerRef,
    ExportPlugin,
} from '@embedpdf/react-pdf-viewer'
import { cn } from "cn";
import { uploadReadonlyMaterial } from "@/app/project/[projectId]/materials/serverActions";

export type PdfEditorHandle = {

    handleDownload: () => void;
    handleSave: () => void;

}

type PdfEditorProps = {

    ref: RefObject<PdfEditorHandle | null>
    src: string,
    onSavingChange: ( isSaving: boolean ) => void,
    className?: string

}

const PdfEditor = ( { ref, src, className = "", onSavingChange }: PdfEditorProps ) => {

    const [ url, setUrl ] = useState<string | null>(src);
    const [ isSaving, setIsSaving ] = useState(false);

    const viewerRef = useRef<PDFViewerRef>(null);

    const getExportScope = async () => {

        const registry = await viewerRef.current?.registry;
        if( !registry ) return null;

        const exportPlugin = registry.getPlugin<ExportPlugin>('export')?.provides()

        if( exportPlugin ) return exportPlugin.forDocument(`2`);

        return null;

    }

    const handleDownload = async () => {

        const scope = await getExportScope()
        scope?.download()

    }

    const handleSave = async () => {

        setIsSaving(true)

        const scope = await getExportScope()

        if( !scope ) {

            setIsSaving(false)
            return;

        }

        try {

            const arrayBuffer = await scope.saveAsCopy().toPromise();

            const blob = new Blob( [ arrayBuffer ], { type: 'application/pdf' } );
            const file = new File( [ blob ], `2.pdf` )

            await uploadReadonlyMaterial( 2, file );

            setUrl(current => {
                if (!current) return current;

                const next = new URL(current);
                next.searchParams.set("cacheNonce", Date.now().toString());
                return next.toString();
            });

        } finally {

            setIsSaving(false)

        }

    }

    useEffect( () => {

        onSavingChange( isSaving )

    }, [isSaving]);

    useImperativeHandle( ref, () => ({

        handleDownload, handleSave

    }), [])

    return (

        <div className={cn( className, "overflow-auto max-w-full", isSaving && 'pointer-events-none opacity-70 cursor-not-allowed')}>

            {

                url &&
                    <PDFViewer
                        key={url}
                        ref={viewerRef}
                        config={{
                            
                            documentManager: {
                                initialDocuments: [
                                    {
                                        url,
                                        documentId: `2`,
                                    },
                                ],
                                },
                                export: {
                                    defaultFileName: `2.pdf`,
                            },
                        }}
                        className="w-full h-full"
                    />

            }

        </div>

    )

}

export default PdfEditor
