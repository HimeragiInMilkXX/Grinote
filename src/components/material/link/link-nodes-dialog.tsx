"use client"

import { getMaterialLinks, listProjectNodes, setMaterialNodeLinks } from "@/app/project/[projectId]/materials/serverActions"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { orderNodesByTree, PickerNode } from "@/lib/materials/node-order"
import { cn } from "@/lib/utils"
import { CheckCircle2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

/** Checklist of the project's tree nodes. Used directly (controlled) or through LinkNodesDialog. */
export const NodeChecklist = ( { nodes, selected, onToggle, className = "" }: { nodes: PickerNode[], selected: Set<string>, onToggle: ( id: string, checked: boolean ) => void, className?: string } ) => {

    const [ query, setQuery ] = useState( "" );

    // the root goal can't hold materials (it never opens in the node panel); its children move up to the top level
    const ordered = useMemo( () => orderNodesByTree( nodes.filter( n => !n.isRoot ) ), [ nodes ] );

    const visible = query.trim()
        ? ordered.filter( n => n.task_name.toLowerCase().includes( query.trim().toLowerCase() ) )
        : ordered;

    return (
        <div className={cn( "flex flex-col gap-2", className )}>
            <Input placeholder="タスクを検索" value={query} onChange={e => setQuery( e.target.value )} />
            <div className="max-h-[50vh] overflow-y-auto flex flex-col border rounded-md p-1.5">
                { visible.length === 0 && <p className="text-sm text-muted-foreground p-3"> タスクがありません </p> }
                { visible.map( n => (
                    <label key={n.id} className="flex items-center gap-2 py-1 px-1.5 rounded hover:bg-muted cursor-pointer text-sm" style={{ paddingLeft: query ? 6 : 6 + n.depth * 16 }}>
                        <Checkbox checked={selected.has( n.id )} onCheckedChange={checked => onToggle( n.id, !!checked )} />
                        { n.isCompleted && <CheckCircle2 size={14} className="text-green-600 shrink-0"/> }
                        <span className="truncate">{ n.task_name }</span>
                    </label>
                ) ) }
            </div>
        </div>
    )

}

const LinkNodesDialog = ( { project_id, material_id, material_name, open, onOpenChange, onSaved }: {
    project_id: string,
    material_id: number,
    material_name?: string,
    open: boolean,
    onOpenChange: ( open: boolean ) => void,
    onSaved?: () => void,
} ) => {

    const [ nodes, setNodes ] = useState<PickerNode[]>( [] );
    const [ selected, setSelected ] = useState<Set<string>>( new Set() );
    const [ loading, setLoading ] = useState( false );
    const [ saving, setSaving ] = useState( false );

    useEffect( () => {

        if( !open ) return;

        setLoading( true );

        Promise.all( [ listProjectNodes( project_id ), getMaterialLinks( project_id, material_id ) ] )
            .then( ( [ allNodes, links ] ) => {
                setNodes( allNodes );
                setSelected( new Set( links.map( l => l.id ) ) );
            } )
            .catch( e => toast.error( String( e ) ) )
            .finally( () => setLoading( false ) );

    }, [ open, project_id, material_id ] );

    const toggle = ( id: string, checked: boolean ) => setSelected( prev => {
        const next = new Set( prev );
        if( checked ) next.add( id ); else next.delete( id );
        return next;
    } );

    const save = async () => {

        setSaving( true );

        try {
            await setMaterialNodeLinks( project_id, material_id, [ ...selected ] );
            toast.success( "リンクを保存しました" );
            onSaved?.();
            onOpenChange( false );
        } catch( e ) {
            toast.error( String( e ) );
        } finally {
            setSaving( false );
        }

    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex flex-col gap-4">
                <DialogHeader>
                    <DialogTitle> タスクにリンク </DialogTitle>
                    <DialogDescription> { material_name ? `「${material_name}」を` : "" }リンクするタスクを選んでください（{selected.size}件選択中） </DialogDescription>
                </DialogHeader>
                { loading ? <p className="text-sm text-muted-foreground"> 読み込み中… </p> : <NodeChecklist nodes={nodes} selected={selected} onToggle={toggle} /> }
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange( false )}> キャンセル </Button>
                    <Button onClick={save} disabled={saving || loading}> 保存 </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )

}

export default LinkNodesDialog
