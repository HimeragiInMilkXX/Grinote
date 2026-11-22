"use client"

import { getMaterialsExistingFilterableColumnValues } from "@/app/project/[projectId]/materials/serverActions"
import PopoverSimplfied from "@/components/miscellaneous/popover"
import { Button } from "@/components/ui/button"
import { RefObject, useEffect, useImperativeHandle, useState } from "react"
import MaterialListFilterPanel from "./material-list-filter-panel"
import MaterialListArrangePanel from "./material-list-arrange-panel"
import z from "zod/v4"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { MaterialFilterableColumns } from "@/types/materials"
import { CircleCheck, CircleX } from "lucide-react"

export const materialListOptionsFormSchema = z.object({

    filter: z.object({

        enableFilterType: z.boolean(),
        enableFilterColor: z.boolean(),
        enableFilterLabel: z.boolean(),

        typeFilter: z.string(),
        colorFilter: z.string(),
        labelFilter: z.string()

    }),

    arrange: z.object({

        column: z.enum([ "type", "label", "color", "created_at", "updated_at" ]),
        direction: z.enum(["asc", "desc"])

    })

})

export type MaterialListOptionsValues = z.infer<typeof materialListOptionsFormSchema>

export type MaterialListOptionsPanelHandle = {

    getOptionsValues: () => MaterialListOptionsValues,

}

const MaterialListOptionsPanel = ({ ref, project_id }: { ref: RefObject<MaterialListOptionsPanelHandle | null>, project_id: string }) => {


    const form = useForm<MaterialListOptionsValues>({

        resolver: zodResolver( materialListOptionsFormSchema ),

        defaultValues: {

            filter: {

                enableFilterType: false,
                enableFilterColor: false,
                enableFilterLabel: false,
                typeFilter: 'readonlys',
                colorFilter: '#000',
                labelFilter: 'uncategorized'

            },

            arrange: {

                column: "updated_at",
                direction: "desc"

            }

        }

    })


    const [ enableFilterType, enableFilterColor, enableFilterLabel, column, direction ] = useWatch({

        control: form.control,
        name: [ "filter.enableFilterType", "filter.enableFilterColor", "filter.enableFilterLabel", "arrange.column", "arrange.direction" ]

    })

    // Whether any option differs from the defaults
    const isOptionsEnabled = enableFilterType || enableFilterColor || enableFilterLabel || !(
        column === "updated_at" && direction === "desc"
    )

    useImperativeHandle( ref, () => ({

        getOptionsValues: () => form.getValues(),

    }), [ form ])

    const [ existingFilterableColumnValues, setExistingFilterableColumnValues ] = useState<Record<MaterialFilterableColumns, string[]>>();

    useEffect( () => {

        getMaterialsExistingFilterableColumnValues( project_id )
            .then( res => setExistingFilterableColumnValues( res ) )

    }, [ project_id ])

    return (
        <PopoverSimplfied
        
            trigger={ <Button variant="ghost" className="bg-blue-300 hover:bg-blue-400! cursor-pointer py-4 px-4.5 flex items-center leading-snug"> Options { isOptionsEnabled ? <CircleCheck size={12}/> : <CircleX size={12}/> } </Button> }
            content={

                <div className="flex flex-col gap-3 w-50">

                    <MaterialListArrangePanel control={form.control}/>
                    { existingFilterableColumnValues && <MaterialListFilterPanel existingFilterableValues={existingFilterableColumnValues} control={form.control}/> }

                </div>

            }

        />
    )
}

export default MaterialListOptionsPanel
