"use client"

import { RefObject, useEffect, useImperativeHandle, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../ui/dialog"
import { z } from "zod/v4"
import { FormProvider, SubmitHandler, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { updateMaterial } from "@/app/project/[projectId]/materials/serverActions"
import { useSetAtom } from "jotai"
import { openedMaterialTabsAtom } from "../material-tabs"
import { Material } from "@/types/materials"
import MaterialEditForm from "./material-edit-form"
import { materialBaseFields } from "../material-common-fields"

export const materialEditFormSchema = z.object( materialBaseFields )

export type MaterialEditFormInput = z.input<typeof materialEditFormSchema>;
export type MaterialEditFormOutput = z.output<typeof materialEditFormSchema>;

export interface MaterialEditPanelHandle {

    toggleOpen: () => void;

}

const toFormValues = ( material: Material ): MaterialEditFormInput => ({

    label: material.label,
    color: material.color,
    name: material.name,
    description: material.description ?? "",

})

const MaterialEditPanel = ( { ref, material, reloadList }: { ref: RefObject<MaterialEditPanelHandle | null>, material: Material, reloadList: () => void } ) => {

    const form = useForm<MaterialEditFormInput, unknown, MaterialEditFormOutput>({

        resolver: zodResolver( materialEditFormSchema ),
        defaultValues: toFormValues( material ),

    })

    const [ open, setOpen ] = useState<boolean>(false)

    useImperativeHandle( ref, () => ({

        toggleOpen: () => setOpen( o => !o )

    }))

    // Re-sync the form with the latest material every time the dialog opens
    useEffect( () => {

        if( open ) form.reset( toFormValues( material ) );

    }, [ open, material, form ])

    const setOpenedTabs= useSetAtom(openedMaterialTabsAtom)

    const onSubmit: SubmitHandler<MaterialEditFormOutput> = async (data) => {

        await updateMaterial( material.project_id, material.id, data )

        setOpenedTabs( ot => ot.filter( item => item.id !== material.id ) );

        reloadList()

        setOpen(false)

    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="flex flex-col gap-4.5">

                <DialogHeader>
                    <DialogTitle>マテリアル編集</DialogTitle>
                </DialogHeader>

                <FormProvider {...form}>

                    <MaterialEditForm onSubmit={onSubmit}/>

                </FormProvider>

            </DialogContent>
        </Dialog>
    )
}

export default MaterialEditPanel
