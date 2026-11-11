import MaterialTabs from "@/components/material/material-tabs"

const ProjectPageMaterial = async ({ params }: { params: any }) => {

    const { projectId } = await params;

    return (

        <div className="w-full pl-[7.5vw] pr-[2.5vw]">
            <MaterialTabs project_id={projectId}/>
        </div>

    )

}

export default ProjectPageMaterial
