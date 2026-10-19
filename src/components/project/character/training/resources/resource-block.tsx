"use client"

import useResource from "@/hooks/useResource"
import { cn } from "cn";

type ResourceBlockProps = {

    projectResource: ProjectResource;
    handleXPChange: ( xp: number, quantity: number ) => void;

}

const ResourceBlock = ( {projectResource, handleXPChange}: ResourceBlockProps ) => {

    const { quantity, consumeResource } = useResource( projectResource, handleXPChange );

    return (
        <div className={cn(
            "bg-center bg-cover bg-no-repeat grow aspect-square leading-tight border-2 bg-gray-200",
            "hover:bg-gray-300 transition-all",
            "active:bg-gray-400 select-none cursor-pointer",
            )}
            style={{ backgroundImage: `url(/resources/${projectResource.resources?.name}.png)`}}
            onClick={async () => await consumeResource()}
            >

            <p className="ml-1 text-left">{quantity}</p>

        </div>
    )
}

export default ResourceBlock
