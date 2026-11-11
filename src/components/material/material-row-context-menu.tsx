import { Eye, SquarePen, Trash } from "lucide-react";
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from "../ui/context-menu"
import { Material } from "@/types/materials";
import MaterialEditPanel, { MaterialEditPanelHandle } from "./edit/material-edit-panel";
import { useRef, useState } from "react";

type MaterialRowContextMenuProps = {

    rowRender: React.ReactElement;
    material: Material;

    view: () => void
    deleteMat: () => void;
    reloadList: () => void;

}

const MaterialRowContextMenu = ( { rowRender, material, view, deleteMat, reloadList }: MaterialRowContextMenuProps ) => {

    const materialEditPanelRef = useRef<MaterialEditPanelHandle>(null);

    return (
        <>
            <MaterialEditPanel ref={materialEditPanelRef} material={material} reloadList={reloadList}/>
            <ContextMenu>
                <ContextMenuTrigger render={rowRender}/>
                <ContextMenuContent>
                    <ContextMenuItem onClick={view}> <Eye/> 閲覧 </ContextMenuItem>
                    <ContextMenuItem onClick={ () => {

                        if( !materialEditPanelRef.current ) return;
                        materialEditPanelRef.current.toggleOpen();

                    }}><SquarePen/> 編集</ContextMenuItem>
                    <ContextMenuItem onClick={deleteMat}> <Trash/> 削除 </ContextMenuItem>
                </ContextMenuContent>
            </ContextMenu>
        </>
    )
}

export default MaterialRowContextMenu
