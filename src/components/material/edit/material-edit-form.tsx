"use client"

import { SubmitHandler, useFormContext } from "react-hook-form"
import { MaterialEditFormInput, MaterialEditFormOutput } from "./material-edit-panel"
import { Button } from "@/components/ui/button";
import MaterialCommonFields from "../material-common-fields";

const MaterialEditForm = ( { onSubmit }: { onSubmit: SubmitHandler<MaterialEditFormOutput> } ) => {

    const { formState: { isSubmitting }, handleSubmit } = useFormContext<MaterialEditFormInput, unknown, MaterialEditFormOutput>();

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">

            <MaterialCommonFields idPrefix="material-edit"/>

            <Button disabled={isSubmitting} type="submit" className="mt-3"> 保存 </Button>

        </form>
    )
}

export default MaterialEditForm
