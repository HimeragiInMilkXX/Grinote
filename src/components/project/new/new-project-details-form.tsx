"use client"

import { handleCreateProject, handleDetailsDef } from "@/app/project/new/clientActions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod/v4"

import dynamic from "next/dynamic";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { redirect } from "next/navigation";
import { addWeeks, format } from "date-fns";

const WEEKDAYS = [
    { value: 1, label: "月" },
    { value: 2, label: "火" },
    { value: 3, label: "水" },
    { value: 4, label: "木" },
    { value: 5, label: "金" },
    { value: 6, label: "土" },
    { value: 7, label: "日" },
];

const DurationPicker = dynamic(() => import("react-duration-picker"), {
    ssr: false,
    loading: () => <div className="text-sm text-muted-foreground">Loading…</div>,
});

export const newProjectDetailsFormSchema = z.object({

    name: z.string().min( 1, "Project name is required" ),
    character_given_name: z.string().max(20, "Character name must be within 20 characters").nonempty(),

    daily_time_goal: z.object({

        hours: z.number().min(0).max(24),
        minutes: z.number().min(0).max(59),
        seconds: z.number().min(0).max(59)

        }).refine(
            val => ( val.hours > 0 || val.minutes > 0 || val.seconds > 0 ) && val.hours * 3600 + val.minutes * 60 + val.seconds >= 120,
            { message: "Please specify a duration greater than or equal to 2 minutes" }
        ).nonoptional(),

    achieve_date_goal: z.coerce
        .date({
            message: "Please select a valid date.",
        })
        .refine(
            (selectedDate) => {

                const minAllowedDate = new Date();
                minAllowedDate.setHours(0, 0, 0, 0);

                minAllowedDate.setDate(minAllowedDate.getDate() + 14);

                return selectedDate >= minAllowedDate;
            },
            {
                message: "Date must be at least 14 days from today.",
            }
        ).nonoptional(),

    description: z.string().optional(),
    work_days: z.array(z.number()).min(1, { message: "Please select at least one day to grind" } ).nonoptional()

})

const NewProjectDetailsForm = () => {

    const form = useForm({

        resolver: zodResolver(newProjectDetailsFormSchema),

        defaultValues: {
            name: "",
            character_given_name: "",
            daily_time_goal: { hours: 0, minutes: 0, seconds: 0 },
            achieve_date_goal: format(addWeeks( new Date(), 2 ), 'yyyy-MM-dd'),
            work_days: [],
            description: ""
        }

    })

    const { isSubmitting } = form.formState;

    async function onSubmit( data: z.infer<typeof newProjectDetailsFormSchema> ) {

        await handleDetailsDef( data );

        const returnData: Project = await handleCreateProject();
        redirect( `/project/new/complete?projectId=${returnData.id}`)

    }

    return (

        <Card className="w-full sm:max-w-md">

            <CardHeader>
                <CardTitle> プロジェクト詳細 </CardTitle>
            </CardHeader>

            <CardContent>
                <form id="new-project-details-form" onSubmit={form.handleSubmit(onSubmit)}>
                    <FieldGroup>

                        {/* Project Name */}
                        <Controller
                            name="name"
                            control={form.control}
                            render={ ( { field, fieldState } ) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="new-project-details-form-name"> コードネーム </FieldLabel>
                                    <Input { ...field } id="new-project-details-form-name" aria-invalid={fieldState.invalid} placeholder="これを達成するぞ！" autoComplete="off" />
                                    { fieldState.invalid && (
                                        <FieldError errors={[fieldState.error]} />
                                    )}
                                </Field>
                            )}
                        />

                        {/* Character Name */}
                        <Controller
                            name="character_given_name"
                            control={form.control}
                            render={ ( { field, fieldState } ) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="new-project-details-form-character-given-name"> キャラクターネーム </FieldLabel>
                                    <Input { ...field } id="new-project-details-form-character-given-name" aria-invalid={fieldState.invalid} placeholder="いい名前を付けよう！" autoComplete="off" />
                                    { fieldState.invalid && (
                                        <FieldError errors={[fieldState.error]} />
                                    )}
                                </Field>
                            )}
                        />

                        {/* Daily Time Goal */}
                        <Controller
                            name="daily_time_goal"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="new-project-details-form-daily-time-goal"> 目標時間（毎日） </FieldLabel>
                                    <DurationPicker
                                        onChange={field.onChange}
                                        initialDuration={{ hours: 0, minutes: 0, seconds: 0}}
                                        maxHours={24}
                                    />
                                    {fieldState.invalid && (
                                        <FieldError errors={[fieldState.error]} />
                                    )}
                                </Field>
                            )}
                        />

                        {/* Achieve Date Goal */}
                        <Controller
                            name="achieve_date_goal"
                            control={form.control}
                            render={ ( { field, fieldState } ) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="new-project-details-form-achieve-date-goal"> 達成日時 </FieldLabel>
                                    <Input {...field} value={field.value == null ? "" : String(field.value)} type="date" id="new-project-details-form-achieve-date-goal" aria-invalid={fieldState.invalid} placeholder="いつ頃目標を達成したい？" autoComplete="off" />
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
                            render={ ( { field, fieldState } ) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="new-project-details-form-description"> 説明（選択） </FieldLabel>
                                    <Textarea className="max-h-[16vh]" {...field} id="new-project-details-form-description" aria-invalid={fieldState.invalid} placeholder="説明入れたほうがわかりやすい！" autoComplete="off" />
                                    { fieldState.invalid && (
                                        <FieldError errors={[fieldState.error]} />
                                    )}
                                </Field>
                            )}
                        />

                        {/* Work Days */}
                        <Controller
                            name="work_days"
                            control={form.control}
                            render={ ( { field, fieldState } ) => (
                                <Field data-invalid={fieldState.invalid}>

                                    <FieldLabel> 週間目標（曜日） </FieldLabel>
                                    <FieldDescription> ＊頑張りたい曜日を選びましょう </FieldDescription>

                                    <div className="flex flex-wrap gap-4">

                                        { WEEKDAYS.map( day => (

                                            <label key={day.value} htmlFor={`new-project-details-work-day-${day.value}`} className="flex items-center gap-2 cursor-pointer">

                                                <Checkbox

                                                    id={`new-project-details-work-day-${day.value}`}
                                                    checked={ field.value?.includes( day.value ) }
                                                    onCheckedChange={ checked => {

                                                        const current = field.value ?? []
                                                        field.onChange( checked ? [ ...current, day.value ] : current.filter( v => v !== day.value ) )

                                                    }}

                                                />

                                                <span className="text-sm"> {day.label} </span>

                                            </label>

                                        ))}

                                    </div>

                                    {fieldState.invalid && (
                                        <FieldError errors={[fieldState.error]} />
                                    )}

                                </Field>
                            )}
                        />

                    </FieldGroup>
                </form>
            </CardContent>

            <CardFooter>
                <Button type="submit" form="new-project-details-form" className="w-full" disabled={isSubmitting}> { isSubmitting ? "送信中..." : "次へ" } </Button>
            </CardFooter>

        </Card>

    )
}

export default NewProjectDetailsForm
