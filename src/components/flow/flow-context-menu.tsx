"use client"

import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { useRef } from "react";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import PlainTextToolTip from "../miscellaneous/plain-text-tooltip";

export interface ContextMenuProps {

    x: number;
    y: number;
    insertNewTask: (e: any, isLoop?: boolean, isAction?: boolean ) => void;
    layoutNodes: () => void;
    saveGraph: () => void;
    insertByInput: ( nodes: string, edges: string ) => void;

}

const FlowContextMenu = ( { x, y, insertNewTask, layoutNodes, saveGraph, insertByInput }: ContextMenuProps ) => {

    const nodesTextareaRef = useRef<HTMLTextAreaElement>(null);
    const edgesTextareaRef = useRef<HTMLTextAreaElement>(null);

    return (
        <Card style={{ left: x, top: y }} className="relative w-50 z-5 shadow-xl">
            <CardHeader>
                <CardTitle>グラフ操作</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5">

                <PlainTextToolTip
                    children={<div className="flex gap-1.5 p-1 rounded-sm hover:bg-gray-100 transition-all" onClick={saveGraph}> 保存 </div>}
                    text="変更内容を保存"/>

                <PlainTextToolTip
                    children={<div className="flex gap-1.5 p-1 rounded-sm hover:bg-gray-100 transition-all" onClick={(e) => insertNewTask(e)}> 新規ノード </div>}
                    text="レベル用のノード"/>

                <PlainTextToolTip
                    children={<div className="flex gap-1.5 p-1 rounded-sm hover:bg-gray-100 transition-all" onClick={(e) => insertNewTask(e, false, true)}> 新規行動 </div>}
                    text="一回だけ実行できるノード"/>

                <PlainTextToolTip
                    children={<div className="flex gap-1.5 p-1 rounded-sm hover:bg-gray-100 transition-all" onClick={(e) => insertNewTask(e, true, true)}> 新規繰り返し行動 </div>}
                    text="何回も実行できるノード"/>

                <PlainTextToolTip
                    children={<div className="flex gap-1.5 p-1 rounded-sm hover:bg-gray-100 transition-all" onClick={layoutNodes}> グラフ整理 </div>}
                    text="グラフのレイアウトを整理（保存されない）"/>

                {/* TEST FOR AGENT */}
                <Dialog>
                    <DialogTrigger render={
                        <PlainTextToolTip
                            children={<div className="flex gap-1.5 p-1 rounded-sm hover:bg-gray-100 transition-all"> データ入力 </div>}
                            text="JSONデータでノードとエッジを生成"/>
                    }/>
                    <DialogContent>
                        <DialogHeader>
                        <DialogTitle> ノートとエッジのデータ張り付けてください </DialogTitle>
                        </DialogHeader>
                        <p>ノート</p>
                        <Textarea ref={nodesTextareaRef} className="max-h-50 resize-none"/>
                        <p>エッジ</p>
                        <Textarea ref={edgesTextareaRef} className="max-h-50 resize-none"/>
                        <DialogFooter className="sm:justify-start">
                            <DialogClose render={<Button type="button" onClick={() => insertByInput( nodesTextareaRef.current!.value, edgesTextareaRef.current!.value )}>確認</Button>} />
                            <DialogClose render={<Button type="button">取消</Button>} />
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

            </CardContent>
        </Card>
    )
}

export default FlowContextMenu
