"use client"

import { useState } from "react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible"

const FloatingCollapsible = ( { trigger, content, hideTriggerOnOpen = false }: { trigger: React.ReactElement, content: React.ReactElement, hideTriggerOnOpen?: boolean }) => {

    const [ isOpen, setIsOpen ] = useState(true)

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>

            { !( isOpen && hideTriggerOnOpen ) && (

                <CollapsibleTrigger render={trigger}/>

            )}

            <CollapsibleContent render={content}/>

        </Collapsible>
    )

}

export default FloatingCollapsible
