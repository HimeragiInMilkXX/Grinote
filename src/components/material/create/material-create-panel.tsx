import { Plus } from "lucide-react"
import { Button } from "../../ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../../ui/dialog"
import { cn } from "cn"
import { useState } from "react"
import MaterialCreateForm from "./material-create-form"
import { z } from "zod/v4"
import { FormProvider, SubmitHandler, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { saveMaterial } from "@/app/project/[projectId]/materials/serverActions"
import { useSetAtom } from "jotai"
import { currentMaterialTabAtom, openedMaterialTabsAtom } from "../material-tabs"

const base = {

    label: z.string().optional(),
    color: z.string().optional(),
    name: z.string().nonempty(),
    description: z.string().optional(),

}

export const materialCreateFormSchema = z.discriminatedUnion( "type", [

    // Readonlys -> File required, link disabled
    z.object({

        ...base,
        type: z.literal("readonlys"),
        file: z.file(),
        link: z.undefined()

    }),

    // playables -> file OR link
    z.object({

        ...base,
        type: z.literal("playables"),
        file: z.file().optional(),
        link: z.string().nonempty().optional(),

    }).refine(
        d => !!d.file !== !!d.link,
        { message: "メディアにはファイルかリンクかどちらか入れてください！", path: ["link"]}
    ),

    // memos -> no file, no link
    z.object({

        ...base,
        type: z.literal("memos"),
        file: z.undefined(),
        link: z.undefined()

    }),

    // externals -> link required, file disabled
    z.object({

        ...base,
        type: z.literal("externals"),
        link: z.string().nonempty(),
        file: z.undefined()

    })

])

export type MaterialCreateFormInput = z.input<typeof materialCreateFormSchema>;
export type MaterialCreateFormOutput = z.output<typeof materialCreateFormSchema>;

const MaterialCreatePanel = ( { project_id }: { project_id: string } ) => {

    const [ open, setOpen ] = useState<boolean>(false)

    const form = useForm<MaterialCreateFormInput, unknown, MaterialCreateFormOutput>({

        resolver: zodResolver( materialCreateFormSchema ),
        defaultValues: { type: "readonlys", color: "#000000", link: undefined, label: "", name: "", file: undefined },
        shouldUnregister: true

    })

    const setOpenedTabs= useSetAtom(openedMaterialTabsAtom)

    const setCurrentTab = useSetAtom(currentMaterialTabAtom);

    const onSubmit: SubmitHandler<MaterialCreateFormOutput> = async (data) => {

        const material = await saveMaterial( project_id, data )

        setOpenedTabs( ot => [ ...ot, { id: material.id, name: material.name } ] );
        setCurrentTab( String(material.id) )

        setOpen(false)

    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger className="inline-flex h-7.2 items-center justify-start gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50" render={
                <Button variant="secondary" className={ cn( "className", "bg-yellow-200 hover:bg-yellow-300 py-1.5! w-20 min-w-20 max-w-20 overflow-hidden hover:[&>.closeOverlay]:opacity-100 hover:[&>.closeOverlay]:pointer-events-auto relative data-active:bg-yellow-300! data-popup-open:bg-yellow-300!" ) }>
                    <Plus size={16} className='cursor-pointer pointer-events-auto!'/>
                </Button>}/>
            <DialogContent className="flex flex-col gap-4.5">

                <DialogHeader>
                    <DialogTitle>新しいマテリアル</DialogTitle>
                </DialogHeader>

                <FormProvider {...form}>

                    <MaterialCreateForm onSubmit={onSubmit}/>

                </FormProvider>

            </DialogContent>
        </Dialog>
    )
}

export default MaterialCreatePanel
