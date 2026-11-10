"use client"

import { MaterialFilterableColumns, materialTypeCaptions } from "@/types/materials"
import { Control, Controller, useWatch } from "react-hook-form";
import { materialListOptionsFormSchema } from "./material-list-options-panel";
import z from "zod/v4";
import { Field, FieldError, FieldGroup } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState } from "react";

type MaterialListFilterPanelProps = {

    existingFilterableValues: Record<MaterialFilterableColumns, string[]>;
    control: Control<z.infer<typeof materialListOptionsFormSchema>>;

}

const MaterialListFilterPanel = ( { existingFilterableValues, control }: MaterialListFilterPanelProps ) => {

    const [ typeSelectItems, setTypeSelectItems ] = useState<{ label: string, value: string }[]>([]);
    const [ colorSelectItems, setColorSelectItems ] = useState<{ label: string, value: string }[]>([]);
    const [ labelSelectItems, setLabelSelectItems ] = useState<{ label: string, value: string }[]>([]);

    useEffect( () => {

        let items: { label: string, value: string }[] = []

        // TYPE
        existingFilterableValues.type.forEach( ( t: string ) => {

            items.push( { label: materialTypeCaptions[t], value: t } )

        })

        setTypeSelectItems( items )
        items = []

        // COLOR
        existingFilterableValues.color.forEach( ( t: string ) => {

            items.push( { label: t, value: t } )

        })

        setColorSelectItems( items );
        items = []

        // Label
        existingFilterableValues.label.forEach( ( t: string ) => {

            items.push( { label: t, value: t } )

        })

        setLabelSelectItems( items );
        items = []

    }, [ existingFilterableValues ])

    const enableFilterType = useWatch( { control, name: "filter.enableFilterType" } );
    const enableFilterColor = useWatch( { control, name: "filter.enableFilterColor" } );
    const enableFilterLabel = useWatch( { control, name: "filter.enableFilterLabel" } );

    return (

        <div className="flex flex-col gap-3">

            {/* Type */}
            <FieldGroup className="flex flex-col gap-1.5">

                {/* Type - Checkbox */}
                <div className="flex gap-3 items-center justify-start">
                    <h3 className={`font-medium leading-tight ml-1`}> タイプ </h3>

                    <Controller
                        name="filter.enableFilterType"
                        control={control}
                        render={ ( { field } ) => (

                                <Checkbox

                                    id="filter-enable-filter-type"
                                    className="select-none border-black/50"
                                    checked={ field.value }
                                    onCheckedChange={field.onChange}

                                />

                        )}
                    />

                </div>

                {/* Type - Select */}
                <Controller
                    name="filter.typeFilter"
                    disabled={!enableFilterType}
                    control={control}
                    render={ ( { field, fieldState } ) => (
                        <Field data-invalid={fieldState.invalid}>
                            <Select
                                name={field.name}
                                value={field.value}
                                onValueChange={field.onChange}
                                disabled={field.disabled}
                                items={typeSelectItems}>
                                <SelectTrigger className="">
                                    <SelectValue/>
                                </SelectTrigger>
                                <SelectContent side="bottom" alignItemWithTrigger={false} sideOffset={4}>
                                    <SelectGroup>
                                    {typeSelectItems.map((item) => (
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

            </FieldGroup>

            {/* Color */}
            <FieldGroup className="flex flex-col gap-1.5">

                {/* Color - Checkbox */}
                <div className="flex gap-3 items-center justify-start">
                    <h3 className={`font-medium leading-tight ml-1`}> カラー </h3>

                    <Controller
                        name="filter.enableFilterColor"
                        control={control}
                        render={ ( { field } ) => (

                                <Checkbox

                                    id="filter-enable-filter-color"
                                    className="select-none border-black/50"
                                    checked={ field.value }
                                    onCheckedChange={field.onChange}

                                />

                        )}
                    />

                </div>

                {/* Color - Select */}
                <Controller
                    name="filter.colorFilter"
                    disabled={!enableFilterColor}
                    control={control}
                    render={ ( { field, fieldState } ) => (
                        <Field data-invalid={fieldState.invalid}>
                            <Select
                                name={field.name}
                                value={field.value}
                                onValueChange={field.onChange}
                                disabled={field.disabled}
                                items={colorSelectItems}>
                                <SelectTrigger className="">
                                    <SelectValue/>
                                </SelectTrigger>
                                <SelectContent side="bottom" alignItemWithTrigger={false} sideOffset={4}>
                                    <SelectGroup>
                                    {colorSelectItems.map((item) => (
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

            </FieldGroup>

            {/* Label */}
            <FieldGroup className="flex flex-col gap-1.5">

                {/* Label - Checkbox */}
                <div className="flex gap-3 items-center justify-start">
                    <h3 className={`font-medium leading-tight ml-1`}> ラベル </h3>

                    <Controller
                        name="filter.enableFilterLabel"
                        control={control}
                        render={ ( { field } ) => (

                                <Checkbox

                                    id="filter-enable-filter-label"
                                    className="select-none border-black/50"
                                    checked={ field.value }
                                    onCheckedChange={field.onChange}

                                />

                        )}
                    />

                </div>

                {/* Label - Select */}
                <Controller
                    name="filter.labelFilter"
                    disabled={!enableFilterLabel}
                    control={control}
                    render={ ( { field, fieldState } ) => (
                        <Field data-invalid={fieldState.invalid}>
                            <Select
                                name={field.name}
                                value={field.value}
                                onValueChange={field.onChange}
                                disabled={field.disabled}
                                items={labelSelectItems}>
                                <SelectTrigger className="">
                                    <SelectValue/>
                                </SelectTrigger>
                                <SelectContent side="bottom" alignItemWithTrigger={false} sideOffset={4}>
                                    <SelectGroup>
                                    {labelSelectItems.map((item) => (
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

            </FieldGroup>

        </div>

    )
}

export default MaterialListFilterPanel
