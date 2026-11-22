"use client"

import { useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { HexAlphaColorPicker } from "react-colorful";
import { z } from "zod/v4";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import PopoverSimplfied from "@/components/miscellaneous/popover";

/** Fields shared by the material create and edit forms. */
export const materialBaseFields = {

    label: z.string().optional(),
    color: z.string().optional(),
    name: z.string().nonempty(),
    description: z.string().optional(),

}

type MaterialCommonFieldValues = {

    name: string;
    description?: string;
    label?: string;
    color?: string;

}

/**
 * Name / description / label / color inputs used by both material forms.
 * Must be rendered inside a react-hook-form `FormProvider`.
 */
const MaterialCommonFields = ( { idPrefix }: { idPrefix: string } ) => {

    const { control } = useFormContext<MaterialCommonFieldValues>();
    const [ isColorOpen, setIsColorOpen ] = useState<boolean>(false);

    return (
        <>
            {/* name */}
            <Controller
                name="name"
                control={control}
                render={ ( { field, fieldState } ) => (
                    <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor={`${idPrefix}-name`}> マテリアル名 </FieldLabel>
                        <Input { ...field } id={`${idPrefix}-name`} aria-invalid={fieldState.invalid} placeholder="マテリアル名" autoComplete="off" />
                        { fieldState.invalid && <FieldError errors={[fieldState.error]} /> }
                    </Field>
                )}
            />

            {/* description */}
            <Controller
                name="description"
                control={control}
                render={ ( { field, fieldState } ) => (
                    <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor={`${idPrefix}-description`}> 説明（選択） </FieldLabel>
                        <Textarea className="max-h-[10vh]" { ...field } id={`${idPrefix}-description`} aria-invalid={fieldState.invalid} placeholder="説明入れたほうがわかりやすい！" autoComplete="off" />
                        { fieldState.invalid && <FieldError errors={[fieldState.error]} /> }
                    </Field>
                )}
            />

            {/* label */}
            <Controller
                name="label"
                control={control}
                render={ ( { field, fieldState } ) => (
                    <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor={`${idPrefix}-label`}> ラベル・カテゴリ </FieldLabel>
                        <Input { ...field } id={`${idPrefix}-label`} aria-invalid={fieldState.invalid} placeholder="Uncategorized" autoComplete="off" />
                        { fieldState.invalid && <FieldError errors={[fieldState.error]} /> }
                    </Field>
                )}
            />

            {/* color */}
            <Controller
                name="color"
                control={control}
                render={ ( { field, fieldState } ) => (
                    <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor={`${idPrefix}-color`} onClick={() => setIsColorOpen(true)}> 代表色 </FieldLabel>
                        <div className="relative">

                            <Input { ...field } id={`${idPrefix}-color`} type="text" aria-invalid={fieldState.invalid} placeholder="#FFFFFF" autoComplete="off" />
                            <PopoverSimplfied

                                props={{ open: isColorOpen, onOpenChange: setIsColorOpen }}

                                trigger={<Button variant="ghost" style={{ backgroundColor: field.value }} className="h-1/2 aspect-square absolute right-3 top-1/2 -translate-y-1/2 border-2 cursor-pointer border-black/30"/>}

                                content={<HexAlphaColorPicker color={field.value} onChange={field.onChange}/>}

                            />

                        </div>
                        { fieldState.invalid && <FieldError errors={[fieldState.error]} /> }
                    </Field>
                )}
            />
        </>
    )
}

export default MaterialCommonFields
