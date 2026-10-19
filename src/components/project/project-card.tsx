"use client"

import Image from "next/image"
import Link from "next/link"

const ProjectCard = ( { project, className = "" }: { project: Project, className?: string } ) => {
    return (
        <Link href={`/project/${project.id}/dashboard`} className={`${className} flex gap-3 rounded-xl border-black/10 border hover:bg-gray-100 transition-all cursor-pointer overflow-hidden`}>

            <Image width={100} loading="eager" height={100} className="aspect-square object-cover" src={`/character/thumbnail/${project.characters?.name}.png`} alt="character"/>

            <section className="box-border p-3 flex flex-col justify-center items-start min-w-50">

                <h4 className="text-2xl font-medium"> {project.name} </h4>
                <p className="text-sm font-light"> {project.description} </p>

            </section>

        </Link>
    )
}

export default ProjectCard
