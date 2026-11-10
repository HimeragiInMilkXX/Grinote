import { Controller, useFormContext, useWatch } from "react-hook-form"
import { MaterialCreateFormInput, MaterialCreateFormOutput } from "./material-create-panel"
import { MaterialType, materialTypeCaptions, MaterialTypeCaptions } from "@/types/materials";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { HexAlphaColorPicker } from "react-colorful";
import PopoverSimplfied from "@/components/miscellaneous/popover";
import { Button } from "@/components/ui/button";
import { useMemo, useRef, useState } from "react";
import { X } from "lucide-react";

const availableTypes: { label: MaterialTypeCaptions, value: MaterialType }[] = [

    { label: materialTypeCaptions.readonlys, value: "readonlys" },
    { label: materialTypeCaptions.playables, value: "playables" },
    { label: materialTypeCaptions.externals, value: "externals" },
    { label: materialTypeCaptions.memos, value: "memos" },

]

const MaterialCreateForm = ( { onSubmit }: { onSubmit: React.FormEventHandler<HTMLFormElement> } ) => {

    const { register, control, watch, formState: { errors, isSubmitting }, handleSubmit, resetField } = useFormContext<MaterialCreateFormInput, unknown, MaterialCreateFormOutput>();

    const type = useWatch( { control, name: "type", defaultValue: "readonlys" } );

    const link = useWatch( { control, name: "link" } );
    const file = useWatch( { control, name: "file" } );

    const showFile = type === "readonlys" || type === "playables"
    const showLink = type === "playables" || type === "externals"

    const [ isSelectOpen, setIsSelectOpen ] = useState<boolean>(false);
    const [ isColorOpen, setIsColorOpen ] = useState<boolean>(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
            {/* type */}
            <Controller
                name="type"
                control={control}
                render={ ( { field, fieldState } ) => (
                    <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="material-create-type" onClick={() => setIsSelectOpen(true)}> タイプ </FieldLabel>
                        <Select
                            open={isSelectOpen}
                            onOpenChange={setIsSelectOpen}
                            name={field.name}
                            value={field.value ?? ""}
                            onValueChange={field.onChange}
                            disabled={field.disabled}
                            items={availableTypes}>
                            <SelectTrigger className="">
                                <SelectValue placeholder="-- 選んでください --"/>
                            </SelectTrigger>
                            <SelectContent side="bottom" alignItemWithTrigger={false} sideOffset={4}>
                                <SelectGroup>
                                {availableTypes.map((item) => (
                                    <SelectItem key={item.value} value={item.value}>
                                        {item.label}
                                    </SelectItem>
                                ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                        { fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                        )}
                    </Field>
                )}
            />

            {/* name */}
            <Controller
                name="name"
                control={control}
                render={ ( { field, fieldState } ) => (
                    <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="material-create-name"> タスクネーム </FieldLabel>
                        <Input { ...field } id="material-create-name" aria-invalid={fieldState.invalid} placeholder="マテリアル名" autoComplete="off" />
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
                        <FieldLabel htmlFor="material-create-label"> ラベル・カテゴリ </FieldLabel>
                        <Input { ...field } id="material-create-label" aria-invalid={fieldState.invalid} placeholder="Uncategorized" autoComplete="off" />
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

                            <Input { ...field } id="material-create-color" type="text" aria-invalid={fieldState.invalid} placeholder="#FFFFFF" autoComplete="off" />
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

            {/* file */}
            { showFile && (

                <Controller
                    name="file"
                    control={control}
                    render={ ( { field, fieldState } ) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="material-create-file"> ファイル </FieldLabel>

                            <div className="relative">

                                <Input
                                    disabled={!!link}
                                    ref={e => { field.ref(e); fileInputRef.current = e}}
                                    name={field.name}
                                    onBlur={field.onBlur}
                                    onChange={(event) =>
                                        field.onChange(event.target.files?.[0])
                                    }
                                    type="file" id="material-create-file" autoComplete="off" />

                                { file && <X size={16} onClick={() => {
                                    resetField("file", { defaultValue: undefined })
                                    if( fileInputRef.current ) fileInputRef.current.value = ""
                                }} className="absolute right-3 top-1/2 -translate-y-1/2 z-2 cursor-pointer"/> }

                            </div>

                            { fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />

                )
            }

            {/* link */}
            { showLink && (

                <Controller
                    name="link"
                    control={control}
                    disabled={!!file}
                    render={ ( { field, fieldState } ) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="material-create-link"> リンク </FieldLabel>
                            <Input { ...field } value={field.value ?? ""} id="material-create-link" aria-invalid={fieldState.invalid} placeholder="https://..." autoComplete="off" />
                            { fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />

            ) }

            <Button disabled={isSubmitting} type="submit" className="mt-3"> 作成 </Button>

        </form>
    )
}

export default MaterialCreateForm
