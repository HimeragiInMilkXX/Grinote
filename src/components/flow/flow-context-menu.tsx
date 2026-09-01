"use client"

import { useReactFlow } from "@xyflow/react";
import { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter } from "../ui/card";
import { useCallback } from "react";

export interface ContextMenuProps {

    x: number;
    y: number;
    insertNewTask: (e: any, isLoop?: boolean, isAction?: boolean ) => void;
    layoutNodes: () => void;
    saveGraph: () => void;

}

const FlowContextMenu = ( { x, y, insertNewTask, layoutNodes, saveGraph }: ContextMenuProps ) => {

    return (
        <Card style={{ left: x, top: y }} className="relative w-50 z-5 shadow-xl">
            <CardHeader>
                <CardTitle>グラフ操作</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5">
                <div className="flex gap-1.5 p-1 rounded-sm hover:bg-gray-100 transition-all" onClick={saveGraph}> 保存 </div>
                <div className="flex gap-1.5 p-1 rounded-sm hover:bg-gray-100 transition-all" onClick={(e) => insertNewTask(e)}> 新規タスク </div>
                <div className="flex gap-1.5 p-1 rounded-sm hover:bg-gray-100 transition-all" onClick={(e) => insertNewTask(e, false, true)}> 新規行動 </div>
                <div className="flex gap-1.5 p-1 rounded-sm hover:bg-gray-100 transition-all" onClick={(e) => insertNewTask(e, true, true)}> 新規繰り返し行動 </div>
                <div className="flex gap-1.5 p-1 rounded-sm hover:bg-gray-100 transition-all" onClick={layoutNodes}> グラフ整理 </div>
            </CardContent>
        </Card>
    )
}

export default FlowContextMenu
