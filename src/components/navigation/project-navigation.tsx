"use client";

import { House, Network, RadioTower } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {

    projectId: string;

}

const ProjectNavigation = ( { projectId }: Props ) => {

    const pathname = usePathname();

    const navItems = [
        {
            href: `/project/${projectId}/dashboard`,
            icon: House,
            label: "Dashboard",
        },
        {
            href: `/project/${projectId}/tree/edit`,
            icon: Network,
            label: "Tree Edit",
        },
        {
            href: `/project/${projectId}/onair`,
            icon: RadioTower,
            label: "On Air",
        },
    ];

    return (
        <nav className="absolute top-1/2 -translate-y-1/2 left-16 z-10">

            <ul className="list-none flex flex-col gap-8 bg-gray-200/50 p-6 py-8 rounded-full">

                {

                    navItems.map( item => {

                        const Icon = item.icon;
                        const isActive = pathname === item.href;

                        return (

                            <li key={item.label} className={`nav-item relative ${ !isActive && 'after:hidden' }`}><Link href={item.href}><Icon size={30} aria-label={item.label}/></Link></li>

                        )

                    })

                }

            </ul>

        </nav>
    )

}

export default ProjectNavigation
