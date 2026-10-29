"use client"

import { Button } from "../ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";

interface NodeContextMenuProps {

    x: number;
    y: number;
    startViewing: () => void;
    deleteNode: () => void;
    duplicateNode: (e: any) => void;

}

const NodeContextMenu = ( { x, y, startViewing, deleteNode, duplicateNode }: NodeContextMenuProps ) => {
    return (
        <Card style={{ left: x, top: y }} className="relative w-50 z-5 shadow-xl">
            <CardHeader>
                <CardTitle>タスク操作</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5">
                <Button variant="ghost" className="justify-start" onClick={startViewing}> 編集 </Button>
                <Button variant="ghost" className="justify-start" onClick={deleteNode}> 削除 </Button>
                <Button variant="ghost" className="justify-start" onClick={duplicateNode}> 複製 </Button>
            </CardContent>
        </Card>
    )
}

export default NodeContextMenu
