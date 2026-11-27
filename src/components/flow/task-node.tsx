"use client"

import type { TaskNodeType } from "@/types/flow"
import { Handle, NodeProps, Position, useNodeId } from "@xyflow/react"
import { Repeat, StickyNote, Check } from 'lucide-react';
import PlainTextToolTip from "../miscellaneous/plain-text-tooltip";
import { useAtomValue } from "jotai";
import { hasActiveTaskAtom } from "./flow-client";
import { nextActionHighlightAtom } from "@/atoms/next_action_atom";
import { ROLE_LABELS } from "@/lib/next-action/labels";

const HIGHLIGHT_RING = {
    progress: "ring-3 ring-amber-400 ring-offset-2",
    practice: "ring-3 ring-sky-400 ring-offset-2",
} as const;

const HIGHLIGHT_BADGE = {
    progress: "bg-amber-400 text-amber-950",
    practice: "bg-sky-400 text-sky-950",
} as const;

const TaskNode = ( { data, draggable: isEditing }: NodeProps<TaskNodeType> ) => {

    const hasActiveTask = useAtomValue( hasActiveTaskAtom );
    const nodeId = useNodeId();
    const nextActionRole = useAtomValue( nextActionHighlightAtom )[ nodeId ?? "" ];

    return (
        <PlainTextToolTip side="bottom"

            children={

                <div
                    className={`task-node p-3 rounded-[3px] min-w-36 text-center hover:shadow-sm border border-gray-700 ${data.task.isCompleted && '*:pointer-events-none opacity-30'} ${nextActionRole ? HIGHLIGHT_RING[ nextActionRole ] : ''}`}
                    style={{ backgroundColor: data.task.bg_color ?? "#fff", color: data.task.text_color ?? "#000" }}
                    >
                    <div className="rounded-[3px]">
                        { !data.task.isRoot && <Handle type="target" position={Position.Left} id="target" />}
                        <div className="font-normal text-[12px]">{data.task.task_name}</div>
                        <Handle type="source" position={Position.Right} id="source" />
                    </div>
                    { nextActionRole && (
                        <span className={`pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-1.5 py-px text-[9px] font-bold whitespace-nowrap shadow-sm ${HIGHLIGHT_BADGE[ nextActionRole ]}`}>
                            次：{ ROLE_LABELS[ nextActionRole ] }
                        </span>
                    ) }
                    { data.task.isCompleted && <Check className="action-attached-icon absolute -left-2.25 -top-2.25 stroke-green-600!" size={24} strokeWidth={4}/> }
                    { data.task.isLoop && <Repeat className="action-attached-icon absolute -right-1.75 -top-2 stroke-black!" size={16} strokeWidth={2.5}/> }
                    { (data.task.isAction && !data.task.isLoop) && <StickyNote className="action-attached-icon absolute -right-1.25 -top-1.5 stroke-black!" size={13} strokeWidth={2.5}/> }
                </div>

            }

            popupElement={

                hasActiveTask ? <div>{data.task.description ? data.task.description : "説明入っていない"}</div> :

                ( (!data.task.isRoot && !data.task.isCompleted) ? (

                    <div className="flex flex-col items-start bg-white/70 text-gray-800">

                        { nextActionRole && <p className="font-semibold"> 次のアクション（{ ROLE_LABELS[ nextActionRole ] }） </p> }

                        { data.task.description && <p> {data.task.description} </p>}

                        <small> { isEditing ? '左クリックで編集：右クリックでメニュー' : '左クリックで開始' } </small>

                    </div>

                ) : <small> 操作不可 </small> )


            }

        />

    )
}

export default TaskNode
