"use client"

import { useAtomValue } from "jotai";
import { CircleCheck, ChevronRight } from "lucide-react"
import Link from "next/link"
import { currentStepAtom } from "./project-tutorial-panel";

const StepLine = ( { step, destination = "/", stepIndex }: { step: string, destination?: string, stepIndex: number }) => {

    const currentStep = useAtomValue(currentStepAtom);

    return (
        <Link href={destination} className={`flex justify-between items-center ${!(stepIndex <= currentStep) && 'pointer-events-none opacity-50 cursor-not-allowed'}`}>
            <section className="flex gap-2 items-center">
                <CircleCheck className={`stroke-1 stroke-gray-300 ${stepIndex < currentStep && 'fill-green-300 stroke-black!'}`} size={18}/>
                <h4>{step}</h4>
            </section>
            <ChevronRight size={16}/>
        </Link>
    )
}

export default StepLine
