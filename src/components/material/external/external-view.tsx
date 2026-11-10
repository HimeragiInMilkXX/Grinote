"use client"

import EmbeddedBrowser from "@/components/material/external/embedded-browser"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "cn"
import { SquareArrowOutUpRight } from "lucide-react"

const ExternalView = ( { src, className = "" }: { src: string, className?: string } ) => {

    return (

        <>
            <div className="w-full flex justify-between px-3 items-center sticky top-0 z-2 bg-white py-6 border-b">
                <h3 className="text-2xl"> マテリアル名 </h3>
                <a className={cn( buttonVariants({variant: "ghost"}), "bg-green-300! py-3 px-4.5" )} href={src} target="_blank"> 別タブに開く <SquareArrowOutUpRight/> </a>
            </div>
            <div className={cn( className, "flex flex-col gap-3 w-full grow" )}>
                <EmbeddedBrowser src={src}/>
            </div>
        </>

    )

}

export default ExternalView
