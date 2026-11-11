"use client"

import { Material, materialTypeCaptions } from "@/types/materials"
import { TableCell, TableRow } from "../ui/table";
import { useAtom, useSetAtom } from "jotai";
import { currentMaterialTabAtom, openedMaterialTabsAtom } from "./material-tabs";
import { useCallback } from "react";
import MaterialRowContextMenu from "./material-row-context-menu";
import { deleteMaterial } from "@/app/project/[projectId]/materials/serverActions";

type MaterialRowProps = {

    material: Material;
    reloadList: () => void;

}

const MaterialRow = ( { material, reloadList }: MaterialRowProps ) => {

    const [ openedTabs, setOpenedTabs ] = useAtom(openedMaterialTabsAtom);
    const setCurrentTab = useSetAtom(currentMaterialTabAtom);

    const view = useCallback( () => {

        const alreadyOpened = openedTabs.some( ( { id } ) => id === material.id )

        if( !alreadyOpened )
            setOpenedTabs( ot => [ ...ot, { id: material.id, name: material.name } ]);

        setCurrentTab( String(material.id) );

    }, [ openedTabs ] )

    const deleteMat = useCallback( async () => {

        try {

            await deleteMaterial(material);

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

            rowRender={
                <TableRow onClick={view}>
                    <TableCell> { materialTypeCaptions[material.type] } </TableCell>
                    <TableCell style={{ color: material.color }}> { material.name } </TableCell>
                    <TableCell> { material.label } </TableCell>
                    <TableCell className="text-right"> { new Date(material.updated_at).toDateString() } { new Date(material.updated_at).toLocaleTimeString() } </TableCell>
                    <TableCell className="text-right"> { new Date(material.updated_at).toDateString() } { new Date(material.created_at).toLocaleTimeString() } </TableCell>
                </TableRow>
            }

        />

    )

}

export default MaterialRow
