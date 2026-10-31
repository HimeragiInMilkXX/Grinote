"use client";

import { getActiveTask } from "@/app/project/[projectId]/onair/serverActions";
import { House, Network, RadioTower, Cat } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { treeRequiresSaveActionAtom } from "@/atoms/tree_requires_save_action_atom";
import { useAtomValue } from "jotai/react";

type Props = {

    projectId: string;

}

const ProjectNavigation = ( { projectId }: Props ) => {

    const pathname = usePathname();

    const navItems = [
        {
            href: `/project/${projectId}/dashboard`,
            icon: House,
            label: "ダッシュボード",
        },
        {
            href: `/project/${projectId}/tree`,
            icon: Network,
            label: "目標ツリー",
        },
        {
            href: `/project/${projectId}/onair`,
            icon: RadioTower,
            label: "ライブタスク",
        },
        {
            href: `/project/${projectId}/character`,
            icon: Cat,
            label: "キャラクター"
        }
    ];

    const [ hasActiveTask, setHasActiveTask ] = useState( false );

    useEffect( () => {

        getActiveTask( projectId ).then( res => setHasActiveTask( res != null ) );

    }, [projectId, pathname])

    // Check Tree Unsaved
    const unsavedChanges = useAtomValue( treeRequiresSaveActionAtom );

    const hasUnsavedChanges = useMemo( () => unsavedChanges.projectId === projectId && unsavedChanges.requiresSave, [ unsavedChanges ] );

    return (
        <nav className="absolute top-1/2 -translate-y-1/2 left-16 z-10">

            <ul className="list-none flex flex-col gap-8 bg-gray-200/50 p-6 py-8 rounded-full">

                {

                    navItems.map( item => {

                        const Icon = item.icon;
                        const isActive = pathname === item.href;
                        const isOnAirPage = item.href === `/project/${projectId}/onair`

                        return (

                            <li key={item.label} className={`nav-item relative ${ !isActive && 'after:hidden' }`}>

                                <Tooltip key="right">

                                    <TooltipTrigger render={

                                        <div>

                                            <Link href={item.href}

                                                onNavigate={e => {

                                                    if( hasUnsavedChanges &&
                                                        !window.confirm( "保存されていない変更を破棄しますか？") )
                                                        e.preventDefault()

                                                }}

                                            ><Icon size={30} aria-label={item.label}/></Link>

                                            { isOnAirPage && ( hasActiveTask && (

                                                <div className="absolute -top-0.5 -right-0.5 rounded-full w-2 aspect-square bg-red-600"></div>

                                            ) ) }

                                        </div>

                                    }/>

                                    <TooltipContent side="right" sideOffset={10}>
                                        <p>{item.label}</p>
                                    </TooltipContent>

                                </Tooltip>

                            </li>

                        )

                    })

                }

            </ul>

        </nav>
    )

}

export default ProjectNavigation
