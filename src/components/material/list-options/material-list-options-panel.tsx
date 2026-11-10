import { getMaterialsExistingFilterableColumnValues } from "@/app/project/[projectId]/materials/serverActions"
import PopoverSimplfied from "@/components/miscellaneous/popover"
import { Button } from "@/components/ui/button"
import { RefObject, useEffect, useImperativeHandle, useState } from "react"
import MaterialListFilterPanel from "./material-list-filter-panel"
import MaterialListArrangePanel from "./material-list-arrange-panel"
import z from "zod/v4"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { MaterialArrangableColumns, MaterialFilterableColumns, MaterialType } from "@/types/materials"

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

export type MaterialListOptionsPanelHandle = {

    getOptionsValues: () => {

        filter: {

        enableFilterType: boolean,
        enableFilterColor: boolean,
        enableFilterLabel: boolean,
        typeFilter: string,
        colorFilter: string,
        labelFilter: string

    },

    arrange: {

        column: string,
        direction: string

    }

    }

}

const MaterialListOptionsPanel = ({ ref, project_id }: { ref: RefObject<MaterialListOptionsPanelHandle | null>, project_id: string }) => {

    const form = useForm({

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

    useImperativeHandle( ref, () => ({

        getOptionsValues: () => form.getValues()

    }), [])

    const [ existingFilterableColumnValues, setExistingFilterableColumnValues ] = useState<Record<MaterialFilterableColumns, string[]>>();

    useEffect( () => {

        getMaterialsExistingFilterableColumnValues( project_id )
            .then( res => setExistingFilterableColumnValues( res ) )

    }, [])

    return (
        <PopoverSimplfied
        
            trigger={ <Button variant="ghost" className="bg-blue-300 hover:bg-blue-400! cursor-pointer py-4 px-4.5"> Options </Button> }
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
