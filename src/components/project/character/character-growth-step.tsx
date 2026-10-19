"use client"

import { useAtom } from "jotai"
import { lvAtom } from "./character-xp-bar"
import { Progress } from "@/components/ui/progress"

const CharacterGrowthStep = ( { growth_step }: { growth_step: Record<number, number> } ) => {

    const [ level, _ ] = useAtom(lvAtom)

    const growthStepsEntries = Object.entries( growth_step );
    const maxLevel = Number(growthStepsEntries[growthStepsEntries.length - 1][0]);

    return (
        <div className="w-full relative my-5">
            <Progress value={(level / maxLevel) * 100} className="w-full">
            </Progress>
            <div className="absolute inset-0 -translate-x-1/40">
                {
                    growthStepsEntries.map( ( [ lv, _ ], index ) => {
                        return (
                            <div key={index} className="bg-white rounded-full absolute top-1/2 -translate-y-1/2 aspect-square w-4 box-border text-xs leading-none border border-black flex items-center justify-center"
                                style={{ left: Number(lv) > 1 ? `${(Number(lv) / maxLevel) * 100}%` : '' }}>{lv}</div>
                        )
                    })
                }
            </div>
        </div>
    )
}

export default CharacterGrowthStep
