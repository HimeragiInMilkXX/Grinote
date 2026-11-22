"use client"

import { getMaterialLinks } from "@/app/project/[projectId]/materials/serverActions"
import { materialListVersionAtom } from "@/atoms/material_atoms"
import { Material, materialTypeCaptions } from "@/types/materials"
import { useAtomValue } from "jotai"
import { Link2 } from "lucide-react"
import { useEffect, useState } from "react"
import LinkNodesDialog from "./link/link-nodes-dialog"
import { MaterialFlagButtons } from "./material-flag-buttons"
import { useMaterialActions } from "./use-material-actions"

/** Name, type, favourite/pin buttons, "link to task" button and linked-task chips. Used as the title of every material view. */
const MaterialViewerHeader = ( { material, onChange }: { material: Material, onChange: ( patch: Partial<Material> ) => void } ) => {

    const { toggleFavourite, togglePin, bumpVersion } = useMaterialActions();

    const version = useAtomValue( materialListVersionAtom );

    const [ links, setLinks ] = useState<{ id: string, task_name: string }[]>( [] );
    const [ linkOpen, setLinkOpen ] = useState( false );

    useEffect( () => {

        getMaterialLinks( material.project_id, material.id ).then( setLinks ).catch( () => setLinks( [] ) );

    }, [ material.project_id, material.id, version ] );

    return (
        <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-3 min-w-0 flex-wrap">
                <h3 className="text-2xl truncate"> { material.name } </h3>
                <span className="text-xs text-muted-foreground border rounded px-1.5 py-0.5 shrink-0"> { materialTypeCaptions[material.type] } </span>
                <MaterialFlagButtons
                    isFavourite={material.is_favourite}
                    isPinned={!!material.pinned_at}
                    onFavourite={async () => { const v = await toggleFavourite( material ); if( v !== null ) onChange( { is_favourite: v } ); }}
                    onPin={async () => { const v = await togglePin( material ); if( v !== false ) onChange( { pinned_at: v } ); }}
                />
                <button type="button" onClick={() => setLinkOpen( true )} className="flex items-center gap-1 text-sm px-2 py-1 rounded hover:bg-muted cursor-pointer shrink-0" title="タスクにリンク">
                    <Link2 size={16}/> タスクにリンク
                </button>
            </div>
            { links.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    { links.map( l => <span key={l.id} className="text-xs bg-yellow-100 border border-yellow-300 rounded-full px-2 py-0.5"> { l.task_name } </span> ) }
                </div>
            ) }
            <LinkNodesDialog project_id={material.project_id} material_id={material.id} material_name={material.name}
                open={linkOpen} onOpenChange={setLinkOpen} onSaved={() => bumpVersion( v => v + 1 )} />
        </div>
    )

}

export default MaterialViewerHeader
