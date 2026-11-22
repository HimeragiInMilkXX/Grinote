import { Eye, Heart, Link2, Pin, SquarePen, Trash } from "lucide-react";
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuCheckboxItem } from "../ui/context-menu"
import { Material } from "@/types/materials";
import MaterialEditPanel, { MaterialEditPanelHandle } from "./edit/material-edit-panel";
import { useRef, useState } from "react";
import LinkNodesDialog from "./link/link-nodes-dialog";
import { useSetAtom } from "jotai";
import { materialListVersionAtom } from "@/atoms/material_atoms";

type MaterialRowContextMenuProps = {

    rowRender: React.ReactElement;
    material: Material;

    view: () => void
    deleteMat: () => void;
    reloadList: () => void;
    toggleFavourite: () => void;
    togglePin: () => void;

}

const MaterialRowContextMenu = ( { rowRender, material, view, deleteMat, reloadList, toggleFavourite, togglePin }: MaterialRowContextMenuProps ) => {

    const materialEditPanelRef = useRef<MaterialEditPanelHandle>(null);

    const [ linkOpen, setLinkOpen ] = useState( false );

    const bumpVersion = useSetAtom( materialListVersionAtom );

    return (
        <>
            <MaterialEditPanel ref={materialEditPanelRef} material={material} reloadList={reloadList}/>
            <LinkNodesDialog project_id={material.project_id} material_id={material.id} material_name={material.name}
                open={linkOpen} onOpenChange={setLinkOpen} onSaved={() => bumpVersion( v => v + 1 )} />
            <ContextMenu>
                <ContextMenuTrigger render={rowRender}/>
                <ContextMenuContent>
                    <ContextMenuItem onClick={view}> <Eye/> 閲覧 </ContextMenuItem>
                    <ContextMenuItem onClick={ () => {

                        if( !materialEditPanelRef.current ) return;
                        materialEditPanelRef.current.toggleOpen();

                    }}><SquarePen/> 編集</ContextMenuItem>
                    <ContextMenuSeparator/>
                    <ContextMenuItem onClick={() => setLinkOpen( true )}> <Link2/> タスクにリンク </ContextMenuItem>
                    <ContextMenuCheckboxItem checked={material.is_favourite} onClick={toggleFavourite}> <Heart/> お気に入り </ContextMenuCheckboxItem>
                    <ContextMenuCheckboxItem checked={!!material.pinned_at} onClick={togglePin}> <Pin/> ピン留め </ContextMenuCheckboxItem>
                    <ContextMenuSeparator/>
                    <ContextMenuItem onClick={deleteMat} variant="destructive"> <Trash/> 削除 </ContextMenuItem>
                </ContextMenuContent>
            </ContextMenu>
        </>
    )
}

export default MaterialRowContextMenu
