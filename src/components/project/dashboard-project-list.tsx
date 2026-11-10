"use client"

import { useSetAtom } from "jotai/react"
import { currentMaterialTabAtom, openedMaterialTabsAtom } from "../material/material-tabs"
import ProjectCard from "./project-card"
import { useEffect } from "react"

interface Props {

    projects: Project[] | null

}

const DashboardProjectList = ( { projects }: Props ) => {

    // Reset Material Tabs
    const setMaterialOpenedTabs = useSetAtom( openedMaterialTabsAtom );
    const setMaterialCurrentTab = useSetAtom( currentMaterialTabAtom );

    useEffect( () => {

        setMaterialCurrentTab( "list" )
        setMaterialOpenedTabs([])

    }, [projects])

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
