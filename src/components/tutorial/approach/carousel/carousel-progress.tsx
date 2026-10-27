import { Button } from "@/components/ui/button";
import { ChevronRight, RotateCcw } from "lucide-react";

type Props = {

    count: number;
    current: number;
    reset: () => void;
    next: () => void;
    action: () => void

}

export default function CarouselProgress( { count, current, reset, next, action }: Props ) {

    return (

        <div className="w-full flex items-center justify-between box-border p-3 pt-5">

            <RotateCcw strokeWidth={3} size={16} onClick={reset} className="cursor-pointer"/>

            { current + 1 < count ? <div className="flex gap-2 items-center">
                {
                    Array.from( { length: count }, ( _, index ) => {
                        return (
                            <div className={`${current === index ? 'bg-gray-500' : 'bg-gray-300/75'} box-border w-3.5 aspect-square rounded-full`} key={String(index)}></div>
                        )
                    })
                }
                <ChevronRight strokeWidth={3} size={18} onClick={next} className="cursor-pointer"/>
            </div>: <Button onClick={action}> Grinoteを始める </Button>}
        </div>

    )

}
