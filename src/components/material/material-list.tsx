"use client"

import { Material } from "@/types/materials";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "../ui/table";
import MaterialRow from "./material-row";
import { cn } from "cn";

type MaterialListProps = {

    materials: Material[];
    className?: string

}

const MaterialList = ( { className = '', materials }: MaterialListProps ) => {

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
                        materials && materials.map( mat => <MaterialRow material={mat} key={mat.id}/>)
                    }
                </TableBody>
            </Table>
        </div>
    )

}

export default MaterialList
