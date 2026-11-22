"use client"

import type { TaskNodeType } from "@/types/flow"
import { Handle, NodeProps, Position } from "@xyflow/react"
import { Repeat, StickyNote, Check } from 'lucide-react';
import PlainTextToolTip from "@/components/miscellaneous/plain-text-tooltip";
import { FieldChangesTable, KindBadge } from "./change-format";

const BORDER: Record<string, string> = {
    added: "border-2 border-green-500",
    updated: "border-2 border-amber-500",
    moved: "border-2 border-blue-500",
    deleted: "border-2 border-dashed border-red-500 opacity-50",
};

const PreviewTaskNode = ( { data }: NodeProps<TaskNodeType> ) => {

    const change = data.previewChange;
    const isDeleted = change?.kinds.includes( "deleted" );
    // Deleted wins, then added, updated, moved
    const primary = change && ( [ "deleted", "added", "updated", "moved" ] as const ).find( k => change.kinds.includes( k ) );

    return (
        <PlainTextToolTip side="bottom"

            children={

                <div
                    className={`task-node relative p-3 rounded-[3px] min-w-36 text-center hover:shadow-sm ${ primary ? BORDER[primary] : "border border-gray-700" } ${data.task.isCompleted && '*:pointer-events-none opacity-30'}`}
                    style={{ backgroundColor: data.task.bg_color ?? "#fff", color: data.task.text_color ?? "#000" }}
                    >
                    <div className="rounded-[3px]">
                        { !data.task.isRoot && <Handle type="target" position={Position.Left} id="target" />}
                        <div className={`font-normal text-[12px] ${ isDeleted ? "line-through" : "" }`}>{data.task.task_name}</div>
                        <Handle type="source" position={Position.Right} id="source" />
                    </div>
                    { change && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex gap-0.5 whitespace-nowrap">
                            { change.kinds.map( k => <KindBadge key={k} kind={k}/> ) }
                        </div>
                    ) }
                    { data.task.isCompleted && <Check className="action-attached-icon absolute -left-2.25 -top-2.25 stroke-green-600!" size={24} strokeWidth={4}/> }
                    { data.task.isLoop && <Repeat className="action-attached-icon absolute -right-1.75 -top-2 stroke-black!" size={16} strokeWidth={2.5}/> }
                    { (data.task.isAction && !data.task.isLoop) && <StickyNote className="action-attached-icon absolute -right-1.25 -top-1.5 stroke-black!" size={13} strokeWidth={2.5}/> }
                </div>

            }

            popupElement={

                change ? (

                    <div className="flex flex-col gap-1.5 max-w-80 bg-white text-gray-800 p-2 rounded shadow">
                        <div className="flex gap-1">{ change.kinds.map( k => <KindBadge key={k} kind={k}/> ) }</div>
                        { change.kinds.includes( "updated" ) && <FieldChangesTable before={change.before} after={change.after}/> }
                        { change.kinds.includes( "moved" ) && (
                            <p className="text-[11px]"> 親：<span className="line-through text-gray-500">{ change.fromParent ?? "なし" }</span> → <b>{ change.toParent ?? "なし" }</b> </p>
                        ) }
                        { change.kinds.includes( "added" ) && data.task.description && <p className="text-[11px]">{data.task.description}</p> }
                        { change.kinds.includes( "deleted" ) && <p className="text-[11px] text-red-700"> このタスクは削除されます </p> }
                        { change.reasons?.map( r => <p key={r} className="text-[11px] text-gray-500">理由：{r}</p> ) }
                    </div>

                ) : <div>{data.task.description ? data.task.description : "説明入っていない"}</div>

            }

        />

    )
}

export default PreviewTaskNode
