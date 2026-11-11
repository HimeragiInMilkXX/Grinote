"use client"

import { Plus } from "lucide-react"
import { Button } from "../../ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../../ui/dialog"
import { cn } from "cn"
import { RefObject, useEffect, useImperativeHandle, useState } from "react"
import MaterialCreateForm from "./material-edit-form"
import { z } from "zod/v4"
import { FormProvider, SubmitHandler, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { saveMaterial, updateMaterial } from "@/app/project/[projectId]/materials/serverActions"
import { useSetAtom } from "jotai"
import { currentMaterialTabAtom, openedMaterialTabsAtom } from "../material-tabs"
import { Material } from "@/types/materials"
import MaterialEditForm from "./material-edit-form"

export const materialEditFormSchema = z.object({

    label: z.string().optional(),
    color: z.string().optional(),
    name: z.string().nonempty(),
    description: z.string().optional(),

})

export type MaterialEditFormInput = z.input<typeof materialEditFormSchema>;
export type MaterialEditFormOutput = z.output<typeof materialEditFormSchema>;

export interface MaterialEditPanelHandle {

    toggleOpen: () => void;

}

const MaterialEditPanel = ( { ref, material, reloadList }: { ref: RefObject<MaterialEditPanelHandle | null>, material: Material, reloadList: () => void } ) => {

    const form = useForm<MaterialEditFormInput, unknown, MaterialEditFormOutput>({

        resolver: zodResolver( materialEditFormSchema ),
        defaultValues: { label: material.label, color: material.color, name: material.name, description: material.description ?? "" },

    })

    const [ open, setOpen ] = useState<boolean>(false)

    useImperativeHandle( ref, () => ({

        toggleOpen: () => setOpen( o => !o )

    }))

    useEffect( () => {

        form.reset();

    }, [open])

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
