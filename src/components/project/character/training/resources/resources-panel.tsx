import { RefObject } from "react";
import { CharacterXPBarHandle } from "../../character-xp-bar";
import ResourceBlock from "./resource-block";
import { saveCharacterProgress } from "@/app/project/[projectId]/character/serverActions";

type ResourcesPanelProps = {

    projectResources: ProjectResource[]
    characterXP: RefObject<CharacterXPBarHandle | null>
    project_id: string

}

const ResourcesPanel = ( { project_id, projectResources, characterXP }: ResourcesPanelProps ) => {

    const handleXPChange = async ( xp: number, quantity: number ) => {

        if( xp < 1 || quantity < 1 || !characterXP.current ) return;

        const { lv, xp: newXP } = characterXP.current.onXPGained( xp * quantity );

        await saveCharacterProgress( project_id, lv, newXP )

    }

    return (

        <div className="flex gap-3 items-center">

            {

                projectResources.map( ( res ) => (

                    <ResourceBlock handleXPChange={handleXPChange} projectResource={res} key={res.id}/>

                ))

            }

        </div>

    )

}

export default ResourcesPanel
