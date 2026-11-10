"use client"

import { TabsTrigger } from '../ui/tabs'
import { Button } from '../ui/button'
import { X } from 'lucide-react'
import { useCallback } from 'react'
import { cn } from 'cn'

const MaterialTabTrigger = ( { closeTab = () => {}, value, label, className = "" }: { closeTab?: ( id: number ) => void, value: string, label: string | React.ReactNode, className?: string }) => {

    const closeTabTrigger = useCallback( (e: any ) => {

        e.stopPropagation()

        try {

            const id = Number(value)
            closeTab( id )

        } finally { return }

    }, [ value, closeTab ])

    return (
        <TabsTrigger value={value} className="flex-none h-fit! " render={
            <Button variant="secondary" className={ cn( className, "py-1.5! w-20 min-w-20 max-w-20 overflow-hidden hover:[&>.closeOverlay]:opacity-100 hover:[&>.closeOverlay]:pointer-events-auto relative bg-gray-100 hover:bg-gray-200 data-active:bg-gray-300!" ) }>
                <p className='text-ellipsis overflow-hidden leading-snug'>{label}</p>
                { value !== "list" && <div className='transition-all closeOverlay opacity-0 pointer-events-none flex left-0 h-full top-0 justify-end pr-1 box-border items-center w-full absolute bg-linear-to-r from-transparent to-gray-300 rounded-md'>
                    <X size={16} onClick={closeTabTrigger} className='cursor-pointer pointer-events-auto!'/>
                </div> }
            </Button>
        }/>
    )
}

export default MaterialTabTrigger
