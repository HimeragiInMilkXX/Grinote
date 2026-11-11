"use client"

import { Controller, useFormContext, useWatch } from "react-hook-form"
import { MaterialEditFormInput, MaterialEditFormOutput } from "./material-edit-panel"
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { HexAlphaColorPicker } from "react-colorful";
import PopoverSimplfied from "@/components/miscellaneous/popover";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";

const MaterialEditForm = ( { onSubmit }: { onSubmit: React.FormEventHandler<HTMLFormElement> } ) => {

    const { control, formState: { isSubmitting }, handleSubmit } = useFormContext<MaterialEditFormInput, unknown, MaterialEditFormOutput>();
    const [ isColorOpen, setIsColorOpen ] = useState<boolean>(false);

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">

            {/* name */}
            <Controller
                name="name"
                control={control}
                render={ ( { field, fieldState } ) => (
                    <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="material-edit-name"> タスクネーム </FieldLabel>
                        <Input { ...field } id="material-edit-name" aria-invalid={fieldState.invalid} placeholder="マテリアル名" autoComplete="off" />
                        { fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                        )}
                    </Field>
                )}
            />

            {/* Description */}
            <Controller
                name="description"
                control={control}
                render={ ( { field, fieldState } ) => (
                    <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="material-edit-description"> 説明（選択） </FieldLabel>
                        <Textarea className="max-h-[10vh]" {...field} id="material-edit-description" aria-invalid={fieldState.invalid} placeholder="説明入れたほうがわかりやすい！" autoComplete="off" />
                        { fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                        )}
                    </Field>
                )}
            />

            {/* label */}
            <Controller
                name="label"
                control={control}
                render={ ( { field, fieldState } ) => (
                    <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="material-edit-label"> ラベル・カテゴリ </FieldLabel>
                        <Input { ...field } id="material-edit-label" aria-invalid={fieldState.invalid} placeholder="Uncategorized" autoComplete="off" />
                        { fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                        )}
                    </Field>
                )}
            />

            {/* color */}
            <Controller
                name="color"
                control={control}
                render={ ( { field, fieldState } ) => (
                    <Field data-invalid={fieldState.invalid}>
                        <FieldLabel onClick={() => setIsColorOpen(true)}> 代表色 </FieldLabel>
                        <div className="relative">

                            <Input { ...field } id="material-edit-color" type="text" aria-invalid={fieldState.invalid} placeholder="#FFFFFF" autoComplete="off" />
                            <PopoverSimplfied

                                props={{ open: isColorOpen, onOpenChange: setIsColorOpen }}

                                trigger={<Button variant="ghost" style={{ backgroundColor: field.value }} className="h-1/2 aspect-square absolute right-3 top-1/2 -translate-y-1/2 border-2 cursor-pointer border-black/30"/>}

                                content={<HexAlphaColorPicker color={field.value} onChange={field.onChange}/>}

                            />

                        </div>
                        { fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                        )}
                    </Field>
                )}
            />

            <Button disabled={isSubmitting} type="submit" className="mt-3"> 保存 </Button>

        </form>
    )
}

export default MaterialEditForm
