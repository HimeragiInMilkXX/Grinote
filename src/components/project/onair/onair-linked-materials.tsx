"use client"

import { getNodeLinks } from "@/app/project/[projectId]/materials/serverActions"
import { assistantPageContextAtom } from "@/atoms/assistant_page_context_atom"
import LinkedMaterialsList from "@/components/material/link/linked-materials-list"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { MaterialSummary } from "@/types/materials"
import { useSetAtom } from "jotai"
import { Paperclip } from "lucide-react"
import { useEffect, useState } from "react"

/** Button + popover with the materials linked to the task being worked on. Opening one shows it in a sheet, so on-air keeps running. */
const OnAirLinkedMaterials = ( { project_id, node_id, initialMaterials }: { project_id: string, node_id: string, initialMaterials: MaterialSummary[] } ) => {

    const [ materials, setMaterials ] = useState<MaterialSummary[]>( initialMaterials );
    const setPageContext = useSetAtom( assistantPageContextAtom );

    useEffect( () => {

        setPageContext( { page: "onair", node_id } );

        return () => setPageContext( { page: "other" } );

    }, [ node_id, setPageContext ] );

    return (
        <Popover onOpenChange={open => { if( open ) getNodeLinks( project_id, node_id ).then( setMaterials ).catch( () => {} ) }}>
            <PopoverTrigger render={
                <Button variant="outline" className="flex items-center gap-1.5">
                    <Paperclip size={16}/> マテリアル（{ materials.length }）
                </Button>
            }/>
            <PopoverContent className="w-80" side="bottom">
                <PopoverHeader>
                    <PopoverTitle> このタスクのマテリアル </PopoverTitle>
                </PopoverHeader>
                <LinkedMaterialsList project_id={project_id} materials={materials}
                    emptyText="リンクされたマテリアルはありません。ツリーのタスク詳細かマテリアル画面からリンクできます。" />
            </PopoverContent>
        </Popover>
    )

}

export default OnAirLinkedMaterials
