"use client"

import { saveResourceConsumedInformation } from "@/app/project/[projectId]/character/serverActions";
import { useState } from "react"

export default function useResource( projectResource: ProjectResource, handleXPChange: ( xp: number, quantity: number ) => void ) {

    const [ quantity, setQuantity ] = useState( projectResource.quantity );

    async function consumeResource( value: number = 1 ) {

        if( quantity < 1 ) return;

        const newQuantity = quantity - value;

        await saveResourceConsumedInformation( projectResource, newQuantity )
        await handleXPChange( projectResource.resources?.xp ?? 0, value )
        setQuantity( newQuantity )

    }

    return { quantity, consumeResource }

}