"use client"

import ProjectCard from "./project-card"

interface Props {

    projects: Project[] | null

}

const DashboardProjectList = ( { projects }: Props ) => {

    return (
        <div className="w-full h-[30vh] overflow-scroll scrollbar-none flex flex-col gap-1.5">

            {

                projects?.map( project => (

                    <ProjectCard project={project} key={project.id} />

                ))

            }

        </div>
    )

}

export default DashboardProjectList
