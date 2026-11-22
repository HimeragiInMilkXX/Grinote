"use client"

import { getNodeLinks, listMaterialsForPicker, nodeExists, setNodeMaterialLinks } from "@/app/project/[projectId]/materials/serverActions"
import LinkedMaterialsList from "@/components/material/link/linked-materials-list"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { MaterialSummary, materialTypeCaptions } from "@/types/materials"
import { Link2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

/**
 * Linked materials of a tree node. Changes are saved to the DB immediately (independent of the tree's 保存).
 * Nodes that aren't saved yet can't be linked.
 */
const NodeMaterialsPicker = ( { project_id, node_id, editable = true }: { project_id: string, node_id: string, editable?: boolean } ) => {

    const [ linked, setLinked ] = useState<MaterialSummary[]>( [] );
    const [ all, setAll ] = useState<MaterialSummary[]>( [] );
    const [ saved, setSaved ] = useState<boolean | null>( null );
    const [ query, setQuery ] = useState( "" );
    const [ busy, setBusy ] = useState( false );

    const load = useCallback( async () => {

        const exists = await nodeExists( project_id, node_id );
        setSaved( exists );
        setLinked( exists ? await getNodeLinks( project_id, node_id ) : [] );

    }, [ project_id, node_id ] );

    useEffect( () => { load().catch( () => setSaved( false ) ) }, [ load ] );

    const loadAll = () => listMaterialsForPicker( project_id ).then( setAll ).catch( e => toast.error( String( e ) ) );

    const toggle = async ( material_id: number, checked: boolean ) => {

        const ids = new Set( linked.map( m => m.id ) );
        if( checked ) ids.add( material_id ); else ids.delete( material_id );

        setBusy( true );

        try {
            await setNodeMaterialLinks( project_id, node_id, [ ...ids ] );
            setLinked( await getNodeLinks( project_id, node_id ) );
        } catch( e ) {
            toast.error( String( e ) );
        } finally {
            setBusy( false );
        }

    }

    const visible = query.trim() ? all.filter( m => m.name.toLowerCase().includes( query.trim().toLowerCase() ) ) : all;
    const linkedIds = new Set( linked.map( m => m.id ) );

    return (
        <div className="flex flex-col gap-1.5 select-text">
            <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-medium flex items-center gap-1.5"> <Link2 size={14}/> リンクされたマテリアル </h3>
                { editable && saved && (
                    <Popover onOpenChange={open => { if( open ) loadAll() }}>
                        <PopoverTrigger render={<Button type="button" variant="outline" size="sm" className="h-7"> 選ぶ（即時保存） </Button>}/>
                        <PopoverContent className="w-80 flex flex-col gap-2" side="left">
                            <Input placeholder="マテリアルを検索" value={query} onChange={e => setQuery( e.target.value )} />
                            <div className="max-h-72 overflow-y-auto flex flex-col">
                                { visible.length === 0 && <p className="text-sm text-muted-foreground p-2"> マテリアルがありません </p> }
                                { visible.map( m => (
                                    <label key={m.id} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-muted cursor-pointer text-sm">
                                        <Checkbox disabled={busy} checked={linkedIds.has( m.id )} onCheckedChange={c => toggle( m.id, !!c )} />
                                        <span className="truncate grow"> { m.name } </span>
                                        <span className="text-xs text-muted-foreground shrink-0"> { materialTypeCaptions[m.type] } </span>
                                    </label>
                                ) ) }
                            </div>
                        </PopoverContent>
                    </Popover>
                ) }
            </div>
            { saved === false
                ? <p className="text-xs text-muted-foreground"> ツリー保存後にリンクできます </p>
                : <LinkedMaterialsList project_id={project_id} materials={linked} /> }
        </div>
    )

}

export default NodeMaterialsPicker
