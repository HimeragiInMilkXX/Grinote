"use client"

import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../ui/dialog"
import PreviewClient from "./preview-client";
import { TaskNodeType } from "@/types/flow";
import { Edge, ReactFlowProvider } from "@xyflow/react";
import { useSetAtom } from "jotai";
import { assistantDrawerOpenAtom } from "@/components/assistant/assistant-drawer";

type Props = {

    onConfirm: () => void;
    onDecline: () => void;
    isOpen: boolean;

    getPreviewGraph: () => { nodes: TaskNodeType[], edges: Edge[] }

}

const RequestedUpdateConfirmationPanel = ( { isOpen, onConfirm, onDecline, getPreviewGraph }: Props ) => {

    const setAssistantDrawerOpen = useSetAtom(assistantDrawerOpenAtom);

    const previewGraph = isOpen ? getPreviewGraph() : null;

    return (
        <Dialog open={isOpen}>
            <DialogContent className="max-w-none! w-[60vw]" showCloseButton={false}>
                <DialogHeader>
                    <DialogTitle> まだ反映されていない生成内容が一時保存されています。 </DialogTitle>
                    <DialogDescription>
                        放棄するか、確認するか、どちらかを選んで続いてご利用ください。
                    </DialogDescription>
                </DialogHeader>

                { previewGraph && (
                    <ReactFlowProvider>
                        <PreviewClient initialNodes={previewGraph.nodes} initialEdges={previewGraph.edges}/>
                    </ReactFlowProvider>
                ) }

                <div className="flex gap-3 items-center">

                    <Button onClick={() => { onConfirm(); setAssistantDrawerOpen(false) }} variant="secondary" className="bg-green-300! hover:bg-green-400! cursor-pointer"> 確認 </Button>
                    <Button onClick={onDecline} variant="secondary" className="bg-red-300! hover:bg-red-400! cursor-pointer"> 放棄 </Button>

                </div>
            </DialogContent>
        </Dialog>
    )
}

export default RequestedUpdateConfirmationPanel
