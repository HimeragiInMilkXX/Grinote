"use client"

import { TabsContent } from "../ui/tabs"
import { cn } from "cn"
import MaterialViewer from "./material-viewer";

const MaterialItemTab = ( { className = '', project_id, material_id }: { className?: string, project_id: string, material_id: number } ) => {

    return (
        <TabsContent keepMounted value={String(material_id)} className={cn(className, "px-6 pb-6 rounded-xl shadow border flex flex-col gap-3 relative w-full max-w-full overflow-scroll scrollbar-none")}>
            <MaterialViewer project_id={project_id} material_id={material_id} />
        </TabsContent>
    )
}

export default MaterialItemTab
