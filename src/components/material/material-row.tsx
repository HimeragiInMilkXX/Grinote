"use client"

import { Material, materialTypeCaptions } from "@/types/materials"
import { TableCell, TableRow } from "../ui/table";
import { useAtom, useSetAtom } from "jotai";
import { currentMaterialTabAtom, openedMaterialTabsAtom } from "./material-tabs";
import { useCallback } from "react";
import MaterialRowContextMenu from "./material-row-context-menu";
import { deleteMaterial } from "@/app/project/[projectId]/materials/serverActions";
import { MaterialFlagButtons } from "./material-flag-buttons";
import { useMaterialActions } from "./use-material-actions";
import { toast } from "sonner";

type MaterialRowProps = {

    material: Material;
    reloadList: () => void;

}

const formatDate = ( iso: string ) => {
    const d = new Date( iso );
    return `${d.toDateString()} ${d.toLocaleTimeString()}`;
}

const MaterialRow = ( { material, reloadList }: MaterialRowProps ) => {

    const [ openedTabs, setOpenedTabs ] = useAtom(openedMaterialTabsAtom);
    const setCurrentTab = useSetAtom(currentMaterialTabAtom);

    const { toggleFavourite, togglePin } = useMaterialActions();

    const view = useCallback( () => {

        const alreadyOpened = openedTabs.some( ( { id } ) => id === material.id )

        if( !alreadyOpened )
            setOpenedTabs( ot => [ ...ot, { id: material.id, name: material.name } ]);

        setCurrentTab( String(material.id) );

    }, [ openedTabs ] )

    const deleteMat = useCallback( async () => {

        if( !window.confirm( `「${material.name}」を削除しますか？タスクとのリンクも解除されます。この操作は元に戻せません。` ) ) return;

        try {

            await deleteMaterial(material);
            setOpenedTabs( ot => ot.filter( t => t.id !== material.id ) );

        } catch( e ) {

            toast.error( String( e ) );

        } finally {

            reloadList();

        }

    }, [ reloadList ] )

    return (

        <MaterialRowContextMenu

            material={material}

            view={view}
            deleteMat={deleteMat}
            reloadList={reloadList}
            toggleFavourite={() => toggleFavourite( material )}
            togglePin={() => togglePin( material )}

            rowRender={
                <TableRow onClick={view} className="cursor-pointer">
                    <TableCell className="w-0">
                        <MaterialFlagButtons isFavourite={material.is_favourite} isPinned={!!material.pinned_at}
                            onFavourite={() => toggleFavourite( material )} onPin={() => togglePin( material )} />
                    </TableCell>
                    <TableCell> { materialTypeCaptions[material.type] } </TableCell>
                    <TableCell style={{ color: material.color }}> { material.name } </TableCell>
                    <TableCell> { material.label } </TableCell>
                    <TableCell className="text-right"> { formatDate( material.updated_at ) } </TableCell>
                    <TableCell className="text-right"> { formatDate( material.created_at ) } </TableCell>
                </TableRow>
            }

        />

    )

}

export default MaterialRow
