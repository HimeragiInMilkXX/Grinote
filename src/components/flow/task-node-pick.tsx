import type { TaskNodeType } from "@/types/flow"
import { Handle, NodeProps, Position } from "@xyflow/react"
import { Repeat, StickyNote, Check } from 'lucide-react';
import PlainTextToolTip from "../miscellaneous/plain-text-tooltip";

const TaskNodePick = ( { data }: NodeProps<TaskNodeType> ) => {
    return (
        <PlainTextToolTip side="bottom"

            children={

                <div
                    className={`task-node p-3 rounded-[3px] min-w-36 text-center hover:shadow-sm border border-gray-700 ${data.task.isCompleted && '*:pointer-events-none opacity-30'}`}
                    style={{ backgroundColor: data.task.bg_color ?? "#fff", color: data.task.text_color ?? "#000" }}
                    >
                    <div className="rounded-[3px]">
                        { !data.task.isRoot && <Handle type="target" position={Position.Left} id="target" />}
                        <div className="font-normal text-[12px]">{data.task.task_name}</div>
                        <Handle type="source" position={Position.Right} id="source" />
                    </div>
                    { data.task.isCompleted && <Check className="action-attached-icon absolute -left-2.25 -top-2.25 stroke-green-600!" size={24} strokeWidth={4}/> }
                    { data.task.isLoop && <Repeat className="action-attached-icon absolute -right-1.75 -top-2 stroke-black!" size={16} strokeWidth={2.5}/> }
                    { (data.task.isAction && !data.task.isLoop) && <StickyNote className="action-attached-icon absolute -right-1.25 -top-1.5 stroke-black!" size={13} strokeWidth={2.5}/> }
                </div>

            }

            popupElement={

                !data.task.isRoot && !data.task.isCompleted ? (

                    <div className="flex flex-col items-start bg-white/70 text-gray-800">

                        { data.task.description && <p> {data.task.description} </p>}

                        <small> 左クリックで閲覧＆開始 </small>

                    </div>

                ) : <small> 操作不可 </small>

            }

        />

    )
}

export default TaskNodePick
