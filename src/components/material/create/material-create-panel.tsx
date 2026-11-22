"use client"

import { CheckCircle2, Circle, FilePlus2, Loader2, Plus, Trash2, TriangleAlert, Upload, XCircle } from "lucide-react"
import { Button } from "../../ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../../ui/dialog"
import { cn } from "@/lib/utils"
import { useEffect, useRef, useState } from "react"
import MaterialCreateForm from "./material-create-form"
import { z } from "zod/v4"
import { listProjectNodes, saveMaterial, setMaterialNodeLinks } from "@/app/project/[projectId]/materials/serverActions"
import { useAtom, useSetAtom } from "jotai"
import { currentMaterialTabAtom, openedMaterialTabsAtom } from "../material-tabs"
import { materialBaseFields } from "../material-common-fields"
import { materialCreateQueueAtom, materialListVersionAtom } from "@/atoms/material_atoms"
import { detectMaterialType, fileBaseName } from "@/lib/materials/detect-type"
import { MaterialType, materialTypeCaptions } from "@/types/materials"
import { PickerNode } from "@/lib/materials/node-order"
import { toast } from "sonner"


export const materialCreateFormSchema = z.discriminatedUnion( "type", [

    // Readonlys -> File required, link disabled
    z.object({

        ...materialBaseFields,
        type: z.literal("readonlys"),
        file: z.file(),
        link: z.undefined()

    }),

    // playables -> file OR link
    z.object({

        ...materialBaseFields,
        type: z.literal("playables"),
        file: z.file().optional(),
        link: z.string().nonempty().optional(),

    }).refine(
        d => !!d.file !== !!d.link,
        { message: "メディアにはファイルかリンクかどちらか入れてください！", path: ["link"]}
    ),

    // memos -> no file, no link
    z.object({

        ...materialBaseFields,
        type: z.literal("memos"),
        file: z.undefined(),
        link: z.undefined()

    }),

    // externals -> link required, file disabled
    z.object({

        ...materialBaseFields,
        type: z.literal("externals"),
        link: z.string().nonempty(),
        file: z.undefined()

    })

])

export type MaterialCreateFormInput = z.input<typeof materialCreateFormSchema>;
export type MaterialCreateFormOutput = z.output<typeof materialCreateFormSchema>;

type QueueStatus = "unchecked" | "checked" | "saving" | "done" | "error" | "rejected";

type QueueItem = {
    key: string;
    file?: File;
    detectedType: MaterialType | null;
    values: MaterialCreateFormInput;
    /** validated values, set once the user confirmed this item */
    output?: MaterialCreateFormOutput;
    node_ids: string[];
    status: QueueStatus;
    error?: string;
};

let keySeq = 0;
const nextKey = () => `q${ ++keySeq }`;

const itemFromFile = ( file: File ): QueueItem => {

    const detectedType = detectMaterialType( file );

    return {
        key: nextKey(),
        file,
        detectedType,
        values: { type: detectedType ?? "readonlys", name: fileBaseName( file.name ), color: "#000000", label: "", description: "", file, link: undefined } as MaterialCreateFormInput,
        node_ids: [],
        status: detectedType ? "unchecked" : "rejected",
        error: detectedType ? undefined : "対応していないファイル形式です（画像・PDF・音声・動画のみ）",
    };

}

const blankItem = (): QueueItem => ( {
    key: nextKey(),
    detectedType: null,
    values: { type: "memos", name: "", color: "#000000", label: "", description: "", file: undefined, link: undefined } as MaterialCreateFormInput,
    node_ids: [],
    status: "unchecked",
} );

const statusIcon = ( status: QueueStatus ) => {
    switch( status ) {
        case "unchecked": return <Circle size={14} className="text-muted-foreground"/>;
        case "checked": return <CheckCircle2 size={14} className="text-green-600"/>;
        case "saving": return <Loader2 size={14} className="animate-spin"/>;
        case "done": return <CheckCircle2 size={14} className="text-blue-600"/>;
        case "error": return <TriangleAlert size={14} className="text-red-500"/>;
        case "rejected": return <XCircle size={14} className="text-red-500"/>;
    }
}

const statusCaption: Record<QueueStatus, string> = {
    unchecked: "未確認", checked: "確認済", saving: "保存中", done: "完了", error: "エラー", rejected: "非対応",
};

const MaterialCreatePanel = ( { project_id }: { project_id: string } ) => {

    const [ open, setOpen ] = useState<boolean>(false)
    const [ items, setItems ] = useState<QueueItem[]>( [] );
    const [ selectedKey, setSelectedKey ] = useState<string | null>( null );
    const [ nodes, setNodes ] = useState<PickerNode[]>( [] );
    const [ savingAll, setSavingAll ] = useState( false );
    const [ isDragging, setIsDragging ] = useState( false );
    const fileInputRef = useRef<HTMLInputElement>( null );

    const setOpenedTabs = useSetAtom(openedMaterialTabsAtom)
    const setCurrentTab = useSetAtom(currentMaterialTabAtom);
    const bumpVersion = useSetAtom( materialListVersionAtom );
    const [ droppedFiles, setDroppedFiles ] = useAtom( materialCreateQueueAtom );

    const addFiles = ( files: File[] ) => {

        const newItems = files.map( itemFromFile );
        setItems( prev => [ ...prev, ...newItems ] );
        const firstUsable = newItems.find( i => i.status !== "rejected" );
        if( firstUsable ) setSelectedKey( k => k ?? firstUsable.key );

    }

    // files dropped on the material list open this dialog
    useEffect( () => {

        if( !droppedFiles || droppedFiles.length === 0 ) return;

        addFiles( droppedFiles );
        setDroppedFiles( null );
        setOpen( true );

    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ droppedFiles ] );

    useEffect( () => {

        if( !open ) return;

        listProjectNodes( project_id ).then( setNodes ).catch( () => setNodes( [] ) );

    }, [ open, project_id ] );

    const onOpenChange = ( next: boolean ) => {

        if( !next && savingAll ) return;

        setOpen( next );

        // clear finished items when closing
        if( !next ) {
            setItems( prev => prev.filter( i => i.status !== "done" ) );
            setSelectedKey( null );
        }

    }

    const updateItem = ( key: string, patch: Partial<QueueItem> ) => setItems( prev => prev.map( i => i.key === key ? { ...i, ...patch } : i ) );

    const removeItem = ( key: string ) => {
        setItems( prev => prev.filter( i => i.key !== key ) );
        if( selectedKey === key ) setSelectedKey( null );
    }

    const addBlank = () => {
        const item = blankItem();
        setItems( prev => [ ...prev, item ] );
        setSelectedKey( item.key );
    }

    const selected = items.find( i => i.key === selectedKey ) ?? null;

    const confirmItem = ( key: string, output: MaterialCreateFormOutput, node_ids: string[] ) => {

        // keep what the user typed so re-opening the item shows it
        const values = { ...output, link: output.link ?? undefined, file: output.file ?? undefined } as MaterialCreateFormInput;

        setItems( prev => {

            const updated = prev.map( i => i.key === key ? { ...i, output, values, node_ids, status: "checked" as QueueStatus, error: undefined } : i );
            const next = updated.find( i => i.status === "unchecked" || i.status === "error" );
            setSelectedKey( next?.key ?? key );
            return updated;

        } );

    }

    const pending = items.filter( i => i.status !== "done" && i.status !== "rejected" );
    const allChecked = pending.length > 0 && pending.every( i => i.status === "checked" );

    const saveAll = async () => {

        setSavingAll( true );

        const created: { id: number, name: string }[] = [];

        for( const item of items ) {

            if( item.status !== "checked" || !item.output ) continue;

            updateItem( item.key, { status: "saving" } );

            try {

                const material = await saveMaterial( project_id, item.output );

                if( item.node_ids.length > 0 ) await setMaterialNodeLinks( project_id, material.id, item.node_ids );

                created.push( { id: material.id, name: material.name } );
                updateItem( item.key, { status: "done" } );

            } catch( e ) {

                updateItem( item.key, { status: "error", error: String( e ) } );

            }

        }

        setSavingAll( false );
        bumpVersion( v => v + 1 );

        if( created.length > 0 ) toast.success( `${created.length}件のマテリアルを作成しました` );

        // a single new material opens straight away, like before
        if( created.length === 1 ) {
            setOpenedTabs( ot => [ ...ot, created[0] ] );
            setCurrentTab( String( created[0].id ) );
        }

        setItems( prev => {
            const remaining = prev.filter( i => i.status !== "done" );
            if( remaining.length === 0 ) { setOpen( false ); setSelectedKey( null ); }
            return remaining;
        } );

    }

    // drop more files directly onto the dialog
    const onDrop = ( e: React.DragEvent ) => {
        if( !Array.from( e.dataTransfer.types ).includes( "Files" ) ) return;
        e.preventDefault();
        setIsDragging( false );
        addFiles( Array.from( e.dataTransfer.files ) );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger className="inline-flex h-7.2 items-center justify-start gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50" render={
                <Button variant="secondary" className={ cn( "bg-yellow-300 hover:bg-yellow-400 py-1.5! w-20 min-w-20 max-w-20 overflow-hidden hover:[&>.closeOverlay]:opacity-100 hover:[&>.closeOverlay]:pointer-events-auto relative data-active:bg-yellow-400! data-popup-open:bg-yellow-400!" ) }>
                    <Plus size={16} className='cursor-pointer pointer-events-auto!'/>
                </Button>}/>
            <DialogContent className="flex flex-col gap-4.5 sm:max-w-4xl max-h-[90vh]"
                onDragOver={e => { if( Array.from( e.dataTransfer.types ).includes( "Files" ) ) { e.preventDefault(); setIsDragging( true ); } }}
                onDragLeave={e => { if( !e.currentTarget.contains( e.relatedTarget as Node | null ) ) setIsDragging( false ); }}
                onDrop={onDrop}>

                <DialogHeader>
                    <DialogTitle>新しいマテリアル</DialogTitle>
                    <DialogDescription> ファイルをドロップすると自動でタイプを判定します。各項目をクリックして詳細を確認してください。 </DialogDescription>
                </DialogHeader>

                <div className="flex gap-4.5 min-h-0 grow">

                    {/* Queue */}
                    <aside className={cn( "w-64 shrink-0 flex flex-col gap-2 min-h-0 rounded-md", isDragging && "ring-2 ring-yellow-400 bg-yellow-50" )}>
                        <div className="flex gap-1.5">
                            <Button type="button" variant="outline" size="sm" className="grow" onClick={() => fileInputRef.current?.click()}> <Upload/> ファイル </Button>
                            <Button type="button" variant="outline" size="sm" className="grow" onClick={addBlank}> <FilePlus2/> メモ/リンク </Button>
                            <input ref={fileInputRef} type="file" multiple hidden onChange={e => { addFiles( Array.from( e.target.files ?? [] ) ); e.target.value = ""; }} />
                        </div>
                        <ul className="flex flex-col gap-1 overflow-y-auto min-h-0 grow border rounded-md p-1">
                            { items.length === 0 && <li className="text-xs text-muted-foreground p-3 text-center"> ここにファイルをドロップ </li> }
                            { items.map( item => (
                                <li key={item.key}>
                                    <div role="button" tabIndex={0}
                                        onClick={() => item.status !== "rejected" && item.status !== "done" && setSelectedKey( item.key )}
                                        onKeyDown={e => { if( e.key === "Enter" && item.status !== "rejected" ) setSelectedKey( item.key ) }}
                                        className={cn( "flex items-start gap-2 px-2 py-1.5 rounded text-sm cursor-pointer hover:bg-muted",
                                            selectedKey === item.key && "bg-muted ring-1 ring-foreground/20",
                                            ( item.status === "rejected" || item.status === "done" ) && "opacity-60 cursor-default" )}>
                                        <span className="mt-0.5">{ statusIcon( item.status ) }</span>
                                        <div className="flex flex-col min-w-0 grow">
                                            <span className="truncate"> { item.values.name || item.file?.name || "（名前なし）" } </span>
                                            <span className="text-xs text-muted-foreground">
                                                { materialTypeCaptions[item.output?.type ?? item.values.type] } ・ { statusCaption[item.status] }
                                            </span>
                                            { item.error && <span className="text-xs text-red-500 break-words"> { item.error } </span> }
                                        </div>
                                        { item.status !== "saving" && item.status !== "done" && (
                                            <button type="button" title="削除" onClick={e => { e.stopPropagation(); removeItem( item.key ); }} className="p-0.5 rounded hover:bg-background">
                                                <Trash2 size={14}/>
                                            </button>
                                        ) }
                                    </div>
                                </li>
                            ) ) }
                        </ul>
                        <Button type="button" onClick={saveAll} disabled={!allChecked || savingAll} className="bg-green-500 hover:bg-green-600">
                            { savingAll ? "保存中…" : `全て保存（${pending.length}件）` }
                        </Button>
                        { !allChecked && pending.length > 0 && <p className="text-xs text-muted-foreground"> 全ての項目を確認すると保存できます </p> }
                    </aside>

                    {/* Details */}
                    <section className="grow min-w-0 overflow-y-auto pr-1">
                        { selected
                            ? <MaterialCreateForm
                                key={selected.key}
                                queuedFile={selected.file}
                                detectedType={selected.detectedType}
                                defaultValues={selected.values}
                                nodes={nodes}
                                defaultNodeIds={selected.node_ids}
                                submitLabel={selected.status === "checked" ? "更新" : "確認して次へ"}
                                onSubmit={( data, node_ids ) => confirmItem( selected.key, data, node_ids )}
                            />
                            : <p className="text-sm text-muted-foreground p-6 text-center"> 左の項目を選んで詳細を入力してください </p> }
                    </section>

                </div>

            </DialogContent>
        </Dialog>
    )
}

export default MaterialCreatePanel
