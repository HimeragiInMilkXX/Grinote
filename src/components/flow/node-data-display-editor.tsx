"use client"

import { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter } from "../ui/card"

import dynamic from "next/dynamic";
import z from "zod/v4";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { TaskNodeType } from "@/types/flow";
import { Field, FieldError, FieldGroup, FieldLabel, FieldDescription } from "../ui/field";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Checkbox } from "../ui/checkbox";
import { Button } from "../ui/button";
import { Ref, useEffect, useImperativeHandle, useState } from "react";
import { useReactFlow } from "@xyflow/react";

const DurationPicker = dynamic(() => import("react-duration-picker"), {
    ssr: false,
    loading: () => <div className="text-sm text-muted-foreground">Loading…</div>,
});

interface Props {

    selectedNode: TaskNodeType;
    onPointerDown: (event: any) => void;

}

export const nodeDetailsFormSchema = z.object({

    task_name: z.string().min( 1, "Task name is required" ),
    bg_color: z.string().optional(),
    text_color: z.string().optional(),
    description: z.string().optional(),

    isAction: z.boolean(),

    time_limit: z.object({

        hours: z.number().min(0).max(24),
        minutes: z.number().min(0).max(59),
        seconds: z.number().min(0).max(59)

        }).refine(
            val => ( val.hours > 0 || val.minutes > 0 || val.seconds > 0 ) && val.hours * 3600 + val.minutes * 60 + val.seconds >= 120,
            { message: "Please specify a duration greater than or equal to 2 minutes" }
        ).optional(),

    isLoop: z.boolean(),
    repetitions_required: z.coerce.number().min( 2, "Please repeat for at least 2 times" )

})

const NodeDataDisplayEditor = ( { selectedNode, onPointerDown }: Props ) => {

    const form = useForm({

        resolver: zodResolver( nodeDetailsFormSchema ),

        defaultValues: {

            ...selectedNode.data.task

        }

    })

    const isLoop = useWatch({

        control: form.control,
        name: 'isLoop'

    })

    const isAction = useWatch({

        control: form.control,
        name: 'isAction'

    })

    const [ isEditing, setIsEditing ] = useState<boolean>(false)
    const { isSubmitting } = form.formState;

    const { updateNode } = useReactFlow();

    const onSubmit = async ( data: z.infer<typeof nodeDetailsFormSchema> ) => {

        setIsEditing( false )

        updateNode( selectedNode.id, () => ({

            data: {

                label: data.task_name,
                task: {
                    
                    ...data,
                    repetitions_completed: selectedNode.data.task.repetitions_completed ?? 0,
                    isRoot: selectedNode.data.task.isRoot ?? false,
                    isCompleted: selectedNode.data.task.isCompleted ?? false
                
                }

            }

        }))

    }

    useEffect( ( ) => {

        setIsEditing( false );
        form.reset( selectedNode.data.task );
        form.setValues( selectedNode.data.task )

    }, [ selectedNode ])

    return (
        <Card className="min-w-100 shadow-xl opacity-80 [*]:select-none ">
            <CardHeader onPointerDown={onPointerDown} className="cursor-grab active:cursor-grabbing">
                <CardTitle className="text-3xl">タスク詳細</CardTitle>
            </CardHeader>
            <CardContent>
                <form id="node-details-form" onSubmit={form.handleSubmit(onSubmit)}>

                    <FieldGroup>

                        {/* Task Name */}
                        <Controller
                            name="task_name"
                            disabled={!isEditing}
                            control={form.control}
                            render={ ( { field, fieldState } ) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="node-details-form-task-name"> タスクネーム </FieldLabel>
                                    <Input { ...field } id="node-details-form-task-name" aria-invalid={fieldState.invalid} placeholder="ちょっとだけでも、これを達成するぞ！" autoComplete="off" />
                                    { fieldState.invalid && (
                                        <FieldError errors={[fieldState.error]} />
                                    )}
                                </Field>
                            )}
                        />

                        {/* Bg Color */}
                        <Controller
                            name="bg_color"
                            control={form.control}
                            disabled={!isEditing}
                            render={ ( { field, fieldState } ) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="node-details-form-bg-color"> ノード色 </FieldLabel>
                                    <Input { ...field } id="node-details-form-bg-color" type="color" aria-invalid={fieldState.invalid} placeholder="かっこいいのを選ぼう！" autoComplete="off" />
                                    { fieldState.invalid && (
                                        <FieldError errors={[fieldState.error]} />
                                    )}
                                </Field>
                            )}
                        />

                        {/* Text Color */}
                        <Controller
                            name="text_color"
                            control={form.control}
                            disabled={!isEditing}
                            render={ ( { field, fieldState } ) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="node-details-form-text-color"> テキスト色 </FieldLabel>
                                    <Input { ...field } id="node-details-form-text-color" type="color" aria-invalid={fieldState.invalid} placeholder="かっこいいのを選ぼう！" autoComplete="off" />
                                    { fieldState.invalid && (
                                        <FieldError errors={[fieldState.error]} />
                                    )}
                                </Field>
                            )}
                        />

                        {/* Description */}
                        <Controller
                            name="description"
                            control={form.control}
                            disabled={!isEditing}
                            render={ ( { field, fieldState } ) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="node-details-form-description"> 説明（選択） </FieldLabel>
                                    <Textarea className="max-h-[16vh]" {...field} id="node-details-form-description" aria-invalid={fieldState.invalid} placeholder="説明入れたほうがわかりやすい！" autoComplete="off" />
                                    { fieldState.invalid && (
                                        <FieldError errors={[fieldState.error]} />
                                    )}
                                </Field>
                            )}
                        />

                        <div className="flex gap-3 items-center justify-start">
                            <h3 className={`${!isAction && 'opacity-65'} text-2xl font-medium`}> 行動詳細 </h3>

                            <Controller
                                name="isAction"
                                control={form.control}
                                disabled={!isEditing}
                                render={ ( { field, fieldState } ) => (

                                        <Checkbox

                                            id="node-details-form-is-action"
                                            disabled={!isEditing}
                                            className="select-none border-black/50"
                                            checked={ field.value }
                                            onCheckedChange={field.onChange}

                                        />

                                )}
                            />

                        </div>

                        {/* Time Limit */}
                        <Controller
                            name="time_limit"
                            control={form.control}
                            disabled={!isEditing}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid} className={`${(!isEditing || !isAction) && 'pointer-events-none [&>.rdp-picker]:opacity-65'}`}>
                                    <FieldLabel htmlFor="node-details-form-time-limit"> 時間制限 </FieldLabel>
                                    <FieldDescription> ＊設定しないなら無制限 </FieldDescription>
                                    <FieldDescription> ＊参考値なので実際は柔軟にやりましょう </FieldDescription>
                                    <DurationPicker
                                        onChange={field.onChange}
                                        initialDuration={selectedNode.data.task.time_limit}
                                        maxHours={24}
                                    />
                                    {fieldState.invalid && (
                                        <FieldError errors={[fieldState.error]} />
                                    )}
                                </Field>
                            )}
                        />

                        {/* Repetition Related */}
                        <Controller
                            name="repetitions_required"
                            control={form.control}
                            disabled={!isEditing}
                            render={ ( { field, fieldState } ) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <div className="flex gap-3 items-center justify-end">

                                        { /* isLoop */ }
                                        <Controller
                                            name="isLoop"
                                            control={form.control}
                                            disabled={!isEditing}
                                            render={({ field, fieldState }) => (

                                                    <Checkbox

                                                        id="node-details-form-isLoop"
                                                        disabled={!isEditing || !isAction}
                                                        className="select-none border-black/50"
                                                        checked={ field.value }
                                                        onCheckedChange={field.onChange}

                                                    />

                                            )}
                                        />

                                        <FieldLabel htmlFor="node-details-form-repetitions-required"> 繰り返す回数 </FieldLabel>

                                    </div>
                                    <Input { ...field } disabled={!isLoop || !isEditing || !isAction} id="node-details-form-reptitions-required" type="number" step={1} aria-invalid={fieldState.invalid} placeholder="練習なら毎日ちょっとでもやらないと！" autoComplete="off" />
                                    { fieldState.invalid && (
                                        <FieldError errors={[fieldState.error]} />
                                    )}
                                </Field>
                            )}
                        />

                    </FieldGroup>

                </form>
            </CardContent>
            <CardFooter className="flex gap-1.5 items-center">
                <Button className="basis-0 grow" type="button" disabled={!isEditing}　onClick={() => setIsEditing(false)}> 取消 </Button>
                {
                    (!isEditing) ?
                        <Button type="button" className="basis-0 grow"   onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            setIsEditing(true)
                        }}> 編集 </Button>
                        : <Button type="submit" form="node-details-form" className="basis-0 grow"> { isSubmitting ? "送信中..." : "保存" } </Button>
                }
            </CardFooter>
        </Card>
    )
}

export default NodeDataDisplayEditor
