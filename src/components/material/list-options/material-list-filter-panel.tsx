"use client"

import { MaterialFilterableColumns, MaterialType, materialTypeCaptions } from "@/types/materials"
import { Control, Controller, useWatch } from "react-hook-form";
import { MaterialListOptionsValues } from "./material-list-options-panel";
import { Field, FieldError, FieldGroup } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type SelectItemOption = { label: string, value: string }

type FilterKey = "Type" | "Color" | "Label"

type MaterialListFilterPanelProps = {

    existingFilterableValues: Record<MaterialFilterableColumns, string[]>;
    control: Control<MaterialListOptionsValues>;

}

/** One filter row: an enable checkbox plus a select of the existing values. */
const FilterSelect = ( { control, filterKey, title, items }: { control: Control<MaterialListOptionsValues>, filterKey: FilterKey, title: string, items: SelectItemOption[] } ) => {

    const isEnabled = useWatch( { control, name: `filter.enableFilter${filterKey}` } );

    return (
        <FieldGroup className="flex flex-col gap-1.5">

            {/* Checkbox */}
            <div className="flex gap-3 items-center justify-start">
                <h3 className="font-medium leading-tight ml-1"> {title} </h3>

                <Controller
                    name={`filter.enableFilter${filterKey}`}
                    control={control}
                    render={ ( { field } ) => (
                        <Checkbox
                            id={`filter-enable-filter-${filterKey.toLowerCase()}`}
                            className="select-none border-black/50"
                            checked={ field.value }
                            onCheckedChange={field.onChange}
                        />
                    )}
                />
            </div>

            {/* Select */}
            <Controller
                name={`filter.${filterKey.toLowerCase() as Lowercase<FilterKey>}Filter`}
                disabled={!isEnabled}
                control={control}
                render={ ( { field, fieldState } ) => (
                    <Field data-invalid={fieldState.invalid}>
                        <Select
                            name={field.name}
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={field.disabled}
                            items={items}>
                            <SelectTrigger>
                                <SelectValue/>
                            </SelectTrigger>
                            <SelectContent side="bottom" alignItemWithTrigger={false} sideOffset={4}>
                                <SelectGroup>
                                {items.map((item) => (
                                    <SelectItem key={item.value} value={item.value}>
                                        {item.label}
                                    </SelectItem>
                                ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                        { fieldState.invalid && <FieldError errors={[fieldState.error]} /> }
                    </Field>
                )}
            />

        </FieldGroup>
    )
}

const toItems = ( values: string[], getLabel: ( value: string ) => string = v => v ): SelectItemOption[] =>
    values.map( value => ( { label: getLabel( value ), value } ) )

const MaterialListFilterPanel = ( { existingFilterableValues, control }: MaterialListFilterPanelProps ) => {

    const typeSelectItems = toItems( existingFilterableValues.type, t => materialTypeCaptions[t as MaterialType] ?? t );
    const colorSelectItems = toItems( existingFilterableValues.color );
    const labelSelectItems = toItems( existingFilterableValues.label );

    return (

        <div className="flex flex-col gap-3">

            <FilterSelect control={control} filterKey="Type" title="タイプ" items={typeSelectItems}/>
            <FilterSelect control={control} filterKey="Color" title="カラー" items={colorSelectItems}/>
            <FilterSelect control={control} filterKey="Label" title="ラベル" items={labelSelectItems}/>

        </div>

    )
}

export default MaterialListFilterPanel
