"use client"

import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../ui/dialog"
import PreviewClient from "./preview-client";
import { ReactFlowProvider } from "@xyflow/react";
import { useSetAtom } from "jotai";
import { assistantDrawerOpenAtom } from "@/components/assistant/assistant-drawer";
import { buildPreviewGraph, type ApplyResult, type Graph } from "@/lib/tree/tree-changes";
import { getLayoutedElements } from "@/app/project/[projectId]/tree/clientActions";
import { ChangeList, DiffCountBadges, KindBadge } from "./change-format";

type Props = {

    onConfirm: () => void;
    onDecline: () => void;
    isOpen: boolean;

    goal?: string;
    warnings?: string[];
    /** Current canvas graph and the result of applying the proposal to it. */
    getPreview: () => { current: Graph, result: ApplyResult } | null;

}

const RequestedUpdateConfirmationPanel = ( { isOpen, onConfirm, onDecline, getPreview, goal, warnings = [] }: Props ) => {

    const setAssistantDrawerOpen = useSetAtom(assistantDrawerOpenAtom);

    const preview = isOpen ? getPreview() : null;
    const result = preview?.result;
    const hasErrors = !!result && result.errors.length > 0;

    let previewGraph: Graph | null = null;
    if( preview ) {
        const { nodes, edges } = buildPreviewGraph( preview.current, preview.result );
        previewGraph = getLayoutedElements( nodes, edges );
    }

    const allWarnings = [ ...warnings, ...( result?.warnings ?? [] ) ];

    return (
        <Dialog open={isOpen}>
            <DialogContent className="max-w-none! w-[80vw]" showCloseButton={false}>
                <DialogHeader>
                    <DialogTitle> AIの変更案がまだ反映されていません </DialogTitle>
                    <DialogDescription>
                        { goal ? `${goal}：` : "" }内容を確認して、適用するか破棄してください。適用後もツリーを保存するまで反映されません。
                    </DialogDescription>
                </DialogHeader>

                <div className="flex gap-4 min-h-0">

                    <div className="flex-1 min-w-0 rounded-md border">
                        { previewGraph && (
                            <ReactFlowProvider>
                                <PreviewClient initialNodes={previewGraph.nodes} initialEdges={previewGraph.edges}/>
                            </ReactFlowProvider>
                        ) }
                    </div>

                    <aside className="w-80 shrink-0 flex flex-col gap-3 max-h-[60vh] overflow-y-auto text-sm">

                        <div className="flex flex-wrap gap-1.5">
                            <KindBadge kind="added"/> <KindBadge kind="updated"/> <KindBadge kind="moved"/> <KindBadge kind="deleted"/>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            ノードにカーソルを合わせると変更前後の内容を確認できます。緑の線は新しい接続、赤い点線は解除される接続です。
                        </p>

                        { result && <div className="flex items-center gap-2"><span className="text-xs font-medium">変更</span><DiffCountBadges diff={result.diff}/></div> }
                        { result && <ChangeList diff={result.diff}/> }

                        { allWarnings.length > 0 && (
                            <ul className="list-disc rounded-md bg-amber-50 py-2 pr-2 pl-6 text-xs text-amber-900">
                                { allWarnings.map( w => <li key={w}>{w}</li> ) }
                            </ul>
                        ) }

                        { hasErrors && (
                            <div className="rounded-md bg-red-50 p-2 text-xs text-red-800">
                                <p className="font-medium mb-1"> 現在のツリーにはこの変更案を適用できません： </p>
                                <ul className="list-disc pl-5"> { result!.errors.map( e => <li key={e}>{e}</li> ) } </ul>
                            </div>
                        ) }

                    </aside>
                </div>

                <div className="flex gap-3 items-center">

                    <Button disabled={hasErrors} onClick={() => { onConfirm(); setAssistantDrawerOpen(false) }} variant="secondary" className="bg-green-300! hover:bg-green-400! cursor-pointer"> 適用 </Button>
                    <Button onClick={onDecline} variant="secondary" className="bg-red-300! hover:bg-red-400! cursor-pointer"> 破棄 </Button>
                    { hasErrors && (
                        <Button onClick={() => { onDecline(); setAssistantDrawerOpen(true) }} variant="outline" className="cursor-pointer"> 破棄してAIに修正を依頼 </Button>
                    ) }

                </div>
            </DialogContent>
        </Dialog>
    )
}

export default RequestedUpdateConfirmationPanel
