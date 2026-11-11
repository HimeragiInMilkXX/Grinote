"use client"

import { Material } from "@/types/materials";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "../ui/table";
import MaterialRow from "./material-row";
import { cn } from "cn";
import { useCallback } from "react";

type MaterialListProps = {

    materials: Material[];
    className?: string
    handleSearch: ( query?: string, page?: number, pageSize?: number ) => void

}

const MaterialList = ( { className = '', materials, handleSearch }: MaterialListProps ) => {

    const reloadList = useCallback( () => handleSearch(), [ handleSearch ] );

    return (
        <div className={ cn( className, "box-border [&>div]:max-h-none!" ) }>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead> タイプ </TableHead>
                        <TableHead> マテリアル名 </TableHead>
                        <TableHead> ラベル </TableHead>
                        <TableHead className="text-right"> 更新日時 </TableHead>
                        <TableHead className="text-right"> 作成日時 </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {
                        materials && materials.map( mat => <MaterialRow material={mat} key={mat.id} reloadList={reloadList}/>)
                    }
                </TableBody>
            </Table>
        </div>
    )

}

export default MaterialList
