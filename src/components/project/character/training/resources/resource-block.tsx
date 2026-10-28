"use client"

import PlainTextToolTip from "@/components/miscellaneous/plain-text-tooltip";
import useResource from "@/hooks/useResource"
import { cn } from "cn";

type ResourceBlockProps = {

    projectResource: ProjectResource;
    handleXPChange: ( xp: number, quantity: number ) => void;
    setDisabled: ( value: boolean ) => void;

}

const ResourceBlock = ( { projectResource, handleXPChange, setDisabled }: ResourceBlockProps ) => {

    const { quantity, consumeResource } = useResource( projectResource, handleXPChange );

    return (
        <PlainTextToolTip
        
            children={

                <div className={cn(
                    "bg-center bg-cover bg-no-repeat grow aspect-square leading-tight border-2 max-w-20 bg-gray-200",
                    "hover:bg-gray-300 transition-all",
                    "active:bg-gray-400 select-none cursor-pointer",
                    `${quantity <= 0 && 'hidden'}`,
                    )}
                    style={{ backgroundImage: `url(/resources/${projectResource.resources?.name}.png)`}}
                    onClick={async () => {
                        setDisabled(true);
                        await consumeResource()
                        setDisabled(false)
                    }}
                    >

                    <p className="ml-1 text-left">{quantity}</p>

                </div>

            }

            popupElement={

                <section className="flex flex-col items-start">

                    <h4> <span className="font-bold">{projectResource.resources?.name}</span> ({projectResource.resources?.type}) <span className="text-green-300">+{projectResource.resources?.xp}</span></h4>
                    <p> {projectResource.resources?.description} </p>

                    <small> 左クリックで与える </small>

                </section>

            }

            side="bottom"

        />
    )
}

export default ResourceBlock
