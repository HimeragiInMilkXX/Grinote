"use client"

import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "../ui/card"

import dynamic from "next/dynamic";
import { Task, TaskNodeType } from "@/types/flow";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "../ui/field";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { redirect } from "next/navigation";
import { GripVertical } from "lucide-react";

const DurationPicker = dynamic(() => import("react-duration-picker"), {
    ssr: false,
    loading: () => <div className="text-sm text-muted-foreground">Loading…</div>,
});

interface Props {

    selectedNode: TaskNodeType;
    onPointerDown: (event: any) => void;
    project_id: string;

}

const NodeDataConfirmPanel = ( { selectedNode, onPointerDown, project_id }: Props ) => {

    const [ data, setData ] = useState<Task>(selectedNode.data.task)

    useEffect( ( ) => {

        setData( selectedNode.data.task )

    }, [ selectedNode ])

    return (
        <Card className="min-w-100 shadow-xl opacity-80 [*]:select-none pt-0">
            <CardHeader onPointerDown={onPointerDown} className="relative cursor-grab active:cursor-grabbing pt-4 flex items-center">
                <GripVertical className="select-none pointer-events-none stroke-gray-600! relative top-0.5"/>
                <CardTitle className="text-3xl">タスク詳細</CardTitle>
            </CardHeader>
            <CardContent>

                    <FieldGroup>

                        <Field>
                            <FieldLabel> タスクネーム </FieldLabel>
                            <Input value={data.task_name} readOnly disabled placeholder="ちょっとだけでも、これを達成するぞ！" autoComplete="off" className="cursor-not-allowed"/>
                        </Field>

                        <Field>
                            <FieldLabel> ノード色 </FieldLabel>
                            <Input value={data.bg_color} readOnly disabled type="color" placeholder="かっこいいのを選ぼう！" autoComplete="off" className="cursor-not-allowed"/>
                        </Field>

                        <Field>
                            <FieldLabel> テキスト色 </FieldLabel>
                            <Input value={data.text_color} readOnly disabled type="color" placeholder="かっこいいのを選ぼう！" autoComplete="off" className="cursor-not-allowed"/>
                        </Field>

                        <Field>
                            <FieldLabel> 説明 </FieldLabel>
                            <Textarea value={data.description} readOnly disabled className="cursor-not-allowed max-h-[16vh]" placeholder="なし" autoComplete="off"/>
                        </Field>

                        { data.isAction &&

                            <>
                                <h3 className={`text-2xl font-medium`}> 行動詳細 </h3>
                                <Field className='pointer-events-none [&>.rdp-picker]:opacity-65'>
                                    <FieldLabel> 時間制限 </FieldLabel>
                                    <FieldDescription> ＊設定しないなら無制限 </FieldDescription>
                                    <FieldDescription> ＊参考値なので実際は柔軟にやりましょう </FieldDescription>
                                    <DurationPicker
                                        onChange={() => {}}
                                        initialDuration={data.time_limit}
                                        maxHours={24}
                                    />
                                </Field>
                                { data.isLoop &&
                                    <Field>
                                        <FieldLabel> 繰り返す回数 </FieldLabel>
                                        <div className="flex items-center gap-1.5">
                                            <Input type="number" readOnly value={data.repetitions_completed} step={1} placeholder="練習なら毎日ちょっとでもやらないと！" autoComplete="off" />
                                            /
                                            <Input type="number" readOnly value={data.repetitions_required} step={1} placeholder="練習なら毎日ちょっとでもやらないと！" autoComplete="off" />
                                        </div>
                                    </Field>
                                }
                            </>

                        }

                    </FieldGroup>

            </CardContent>
            <CardFooter className="flex gap-1.5 items-center">
                { (data.isAction && !data.isCompleted) ?

                    <Button className="w-full bg-green-500 hover:bg-green-600" onClick={() => redirect(`/project/${project_id}/onair?nodeId=${selectedNode.id}`)}> スタート </Button> :
                    <Button className="w-full" disabled> このノートは行動ではないです </Button>

                }
            </CardFooter>
        </Card>
    )
}

export default NodeDataConfirmPanel
