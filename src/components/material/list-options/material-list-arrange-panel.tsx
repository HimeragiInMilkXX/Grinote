"use client"

import { MaterialArrangableColumns, materialColumnsCaption } from "@/types/materials"
import { useEffect } from "react"
import { Control, Controller } from "react-hook-form"
import z from "zod/v4"
import { materialListOptionsFormSchema } from "./material-list-options-panel"
import { Field, FieldError, FieldGroup } from "@/components/ui/field"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { ListSortAscending, ListSortDescending } from "lucide-react"

const arrangeValuesItems: { label: MaterialArrangableColumns, value: { column: MaterialArrangableColumns, direction: "asc" | "desc" } }[] = [

    { label: "type", value: { column: "type", direction: "asc" } },
    { label: "label", value: { column: "label", direction: "asc" } },
    { label: "color", value: { column: "color", direction: "asc" } },
    { label: "created_at", value: { column: "created_at", direction: "asc" } },
    { label: "created_at", value: { column: "created_at", direction: "desc" } },
    { label: "updated_at", value: { column: "updated_at", direction: "asc" } },
    { label: "updated_at", value: { column: "updated_at", direction: "desc" } },

]

const MaterialListArrangePanel = ( { control }: { control: Control<z.infer<typeof materialListOptionsFormSchema>> }) => {

    return (
            <FieldGroup className="flex flex-col gap-1.5">

                {/* Type - Select */}
                <Controller
                    name="arrange"
                    control={control}
                    render={ ( { field, fieldState } ) => (
                        <Field data-invalid={fieldState.invalid}>
                            <Label htmlFor="arrange" className="ml-1"> 並び方 </Label>
                            <Select
                                name={field.name}
                                value={field.value ?? null}
                                onValueChange={field.onChange}
                                items={arrangeValuesItems}
                                itemToStringLabel={(value) =>
                                    `${materialColumnsCaption[value.column]} ${
                                    (value.column === "created_at" || value.column === "updated_at") ? (value.direction === "asc" ? "↑" : "↓") : ""
                                    }`
                                }
                                isItemEqualToValue={(item, value) =>
                                    item.column === value.column &&
                                    item.direction === value.direction
                                }
                                id="arrange">
                                <SelectTrigger className="">
                                    <SelectValue placeholder="-- 選んでください --"/>
                                </SelectTrigger>
                                <SelectContent side="bottom" alignItemWithTrigger={false} sideOffset={4}>
                                    <SelectGroup>
                                    {arrangeValuesItems.map((item, index) => (
                                        <SelectItem key={index} value={item.value} className="items-center flex leading-tight">
                                            { materialColumnsCaption[item.label] }
                                            { (item.label === "created_at" || item.label === "updated_at") && (

                                                item.value.direction === "asc" ? <ListSortAscending/> : <ListSortDescending/>

                                            )}
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
    )

}

export default MaterialListArrangePanel
