"use client";

import { handleGoalDef } from "@/app/project/new/clientActions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form"
import z from "zod/v4"

export const newProjectGoalFormSchema = z.object({

    goal: z.string("Please enter the ability/skill that you want to achieve with Grinote!").nonempty()

})

const NewProjectGoalForm = () => {

    const form = useForm<z.infer<typeof newProjectGoalFormSchema>>({

        resolver: zodResolver( newProjectGoalFormSchema ),
        defaultValues: {

            goal: ""

        }

    })

    const { isSubmitting } = form.formState;

    return (
        <Card className="w-full sm:max-w-md">

            <CardHeader>
                <CardTitle> 達成したい目標教えてください </CardTitle>
            </CardHeader>

            <CardContent>

                <form id="new-project-goal-form" onSubmit={form.handleSubmit(handleGoalDef)}>

                    <FieldGroup>
                        <Controller
                            name="goal"
                            control={form.control}
                            render={ ( { field, fieldState } ) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <Input { ...field } id="new-project-goal-form-goal" aria-invalid={fieldState.invalid} placeholder="ヴィオラをマスターする..." autoComplete="off" />
                                    { fieldState.invalid && (
                                        <FieldError errors={[fieldState.error]} />
                                    )}
                                </Field>
                            )}
                        />
                    </FieldGroup>

                </form>

            </CardContent>

            <CardFooter>
                <Button type="submit" form="new-project-goal-form" className="w-full" disabled={isSubmitting}> { isSubmitting ? "送信中..." : "次へ" } </Button>
            </CardFooter>

        </Card>
    )
}

export default NewProjectGoalForm
