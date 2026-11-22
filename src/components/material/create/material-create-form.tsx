"use client"

import { Controller, SubmitHandler, useFormContext, useWatch } from "react-hook-form"
import { MaterialCreateFormInput, MaterialCreateFormOutput } from "./material-create-panel"
import { MaterialType, materialTypeCaptions, MaterialTypeCaptions } from "@/types/materials";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import MaterialCommonFields from "../material-common-fields";

const availableTypes: { label: MaterialTypeCaptions, value: MaterialType }[] = [

    { label: materialTypeCaptions.readonlys, value: "readonlys" },
    { label: materialTypeCaptions.playables, value: "playables" },
    { label: materialTypeCaptions.externals, value: "externals" },
    { label: materialTypeCaptions.memos, value: "memos" },

]

const MaterialCreateForm = ( { onSubmit }: { onSubmit: SubmitHandler<MaterialCreateFormOutput> } ) => {

    const { control, formState: { isSubmitting }, handleSubmit, resetField } = useFormContext<MaterialCreateFormInput, unknown, MaterialCreateFormOutput>();

    const type = useWatch( { control, name: "type", defaultValue: "readonlys" } );

    const link = useWatch( { control, name: "link" } );
    const file = useWatch( { control, name: "file" } );

    // Check if file type is correct
    useEffect( () => {

        if( !file ) return;

        const fileType = file.type;

        if( ( type === "playables" && ( fileType.includes("audio/") || fileType.includes("video/") ) ) ||
            ( type === "readonlys" && ( fileType.includes("image/") || fileType.includes("application/pdf" ) ) ) ) return;

        alert("エラー")

        resetField("file");

        if( !fileInputRef.current ) return;

        fileInputRef.current.value = "";

    }, [file])

    const showFile = type === "readonlys" || type === "playables"
    const showLink = type === "playables" || type === "externals"

    const [ isSelectOpen, setIsSelectOpen ] = useState<boolean>(false);

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

            <MaterialCommonFields idPrefix="material-create"/>

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
                                    type="file" id="material-create-file" autoComplete="off"
                                    accept={type === "playables" ? "audio/*, video/*" : "image/*, application/pdf"}/>

                                { file && <X size={16} onClick={() => {
                                    resetField("file", { defaultValue: undefined })
                                    if( fileInputRef.current ) fileInputRef.current.value = ""
                                }} className="absolute right-3 top-1/2 -translate-y-1/2 z-2 cursor-pointer"/> }

                            </div>

                            <FieldDescription>
                                { type === "playables" ? "* 動画やオディオファイルだけアップしてください" : "* 写真やPDFファイルだけアップしてください"}
                            </FieldDescription>

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
