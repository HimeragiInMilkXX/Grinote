"use client"

import { Material, materialTypeCaptions } from "@/types/materials"
import { TableCell, TableRow } from "../ui/table";
import { useAtom, useSetAtom } from "jotai";
import { currentMaterialTabAtom, openedMaterialTabsAtom } from "./material-tabs";
import { useCallback } from "react";

type MaterialRowProps = {

    material: Material;

}

const MaterialRow = ( { material }: MaterialRowProps ) => {

    const [ openedTabs, setOpenedTabs ] = useAtom(openedMaterialTabsAtom);
    const setCurrentTab = useSetAtom(currentMaterialTabAtom);

    const onClick = useCallback( () => {

        const alreadyOpened = openedTabs.some( ( { id } ) => id === material.id )

        if( !alreadyOpened )
            setOpenedTabs( ot => [ ...ot, { id: material.id, name: material.name } ]);

        setCurrentTab( String(material.id) );

    }, [ openedTabs ] )

    return (

        <TableRow onClick={onClick}>
            <TableCell> { materialTypeCaptions[material.type] } </TableCell>
            <TableCell style={{ color: material.color }}> { material.name } </TableCell>
            <TableCell> { material.label } </TableCell>
            <TableCell className="text-right"> { new Date(material.updated_at).toDateString() } { new Date(material.updated_at).toLocaleTimeString() } </TableCell>
            <TableCell className="text-right"> { new Date(material.updated_at).toDateString() } { new Date(material.created_at).toLocaleTimeString() } </TableCell>
        </TableRow>

    )

}

export default MaterialRow
