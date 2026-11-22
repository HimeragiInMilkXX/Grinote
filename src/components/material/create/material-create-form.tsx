"use client"

import { Controller, FormProvider, SubmitHandler, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { materialCreateFormSchema, MaterialCreateFormInput, MaterialCreateFormOutput } from "./material-create-panel"
import { MaterialType, materialTypeCaptions, MaterialTypeCaptions } from "@/types/materials";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";
import MaterialCommonFields from "../material-common-fields";
import { detectMaterialType } from "@/lib/materials/detect-type";
import { NodeChecklist } from "../link/link-nodes-dialog";
import { PickerNode } from "@/lib/materials/node-order";

const availableTypes: { label: MaterialTypeCaptions, value: MaterialType }[] = [

    { label: materialTypeCaptions.readonlys, value: "readonlys" },
    { label: materialTypeCaptions.playables, value: "playables" },
    { label: materialTypeCaptions.externals, value: "externals" },
    { label: materialTypeCaptions.memos, value: "memos" },

]

type Props = {
    /** File queued by drag & drop / multi-select; fixed for this item */
    queuedFile?: File;
    /** Type grinote detected from the file */
    detectedType?: MaterialType | null;
    defaultValues: MaterialCreateFormInput;
    nodes: PickerNode[];
    defaultNodeIds: string[];
    submitLabel: string;
    onSubmit: ( data: MaterialCreateFormOutput, node_ids: string[] ) => void | Promise<void>;
}

/** Details form for one material in the create queue. */
const MaterialCreateForm = ( { queuedFile, detectedType, defaultValues, nodes, defaultNodeIds, submitLabel, onSubmit }: Props ) => {

    const form = useForm<MaterialCreateFormInput, unknown, MaterialCreateFormOutput>({

        resolver: zodResolver( materialCreateFormSchema ),
        defaultValues,
        shouldUnregister: true

    })

    const { control, formState: { isSubmitting }, handleSubmit, resetField, setError } = form;

    const type = useWatch( { control, name: "type" } );
    const link = useWatch( { control, name: "link" } );
    const file = useWatch( { control, name: "file" } );

    const [ nodeIds, setNodeIds ] = useState<Set<string>>( new Set( defaultNodeIds ) );
    const [ isSelectOpen, setIsSelectOpen ] = useState<boolean>(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const showFile = type === "readonlys" || type === "playables"
    const showLink = type === "playables" || type === "externals"

    const submit: SubmitHandler<MaterialCreateFormOutput> = async ( data ) => {

        if( data.file && detectMaterialType( data.file ) !== data.type ) {
            setError( "file", { message: `このファイルは「${materialTypeCaptions[data.type]}」として保存できません` } );
            return;
        }

        await onSubmit( data, [ ...nodeIds ] );

    }

    return (
        <FormProvider {...form}>
            <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-3">
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
                                onValueChange={value => {
                                    field.onChange( value );
                                    // keep the queued file when switching between file types
                                    if( queuedFile ) resetField( "file", { defaultValue: ( value === "readonlys" || value === "playables" ) ? queuedFile : undefined } );
                                }}
                                disabled={field.disabled}
                                items={availableTypes}>
                                <SelectTrigger>
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
                            { detectedType && (
                                <FieldDescription className="flex items-center gap-1">
                                    <Sparkles size={12}/> 自動判定: { materialTypeCaptions[detectedType] }{ detectedType !== type && "（手動で変更済み）" }
                                </FieldDescription>
                            ) }
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

                                { queuedFile
                                    ? <p className="text-sm border rounded-md px-3 py-2 truncate"> { queuedFile.name } </p>
                                    : (
                                        <div className="relative">
                                            <Input
                                                disabled={!!link}
                                                ref={e => { field.ref(e); fileInputRef.current = e}}
                                                name={field.name}
                                                onBlur={field.onBlur}
                                                onChange={(event) => field.onChange(event.target.files?.[0])}
                                                type="file" id="material-create-file" autoComplete="off"
                                                accept={type === "playables" ? "audio/*, video/*" : "image/*, application/pdf"}/>

                                            { file && <X size={16} onClick={() => {
                                                resetField("file", { defaultValue: undefined })
                                                if( fileInputRef.current ) fileInputRef.current.value = ""
                                            }} className="absolute right-3 top-1/2 -translate-y-1/2 z-2 cursor-pointer"/> }
                                        </div>
                                    ) }

                                <FieldDescription>
                                    { type === "playables" ? "* 動画やオーディオファイルだけアップしてください" : "* 写真やPDFファイルだけアップしてください"}
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
                { showLink && !( queuedFile && type === "playables" ) && (

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

                {/* linked tasks */}
                <Field>
                    <FieldLabel> リンクするタスク（任意・{nodeIds.size}件） </FieldLabel>
                    <NodeChecklist nodes={nodes} selected={nodeIds} onToggle={( id, checked ) => setNodeIds( prev => {
                        const next = new Set( prev );
                        if( checked ) next.add( id ); else next.delete( id );
                        return next;
                    } )} className="[&>div:last-child]:max-h-40" />
                </Field>

                <Button disabled={isSubmitting} type="submit" className="mt-3"> { submitLabel } </Button>

            </form>
        </FormProvider>
    )
}

export default MaterialCreateForm
