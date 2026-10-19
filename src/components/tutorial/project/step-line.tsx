import { CircleCheck, ChevronRight } from "lucide-react"
import Link from "next/link"

const StepLine = ( { step, isCompleted, destination = "/", isAvailable = false }: { step: string, isCompleted: boolean, destination?: string, isAvailable?: boolean }) => {
    return (
        <div className={`flex justify-between items-center ${!isAvailable && 'pointer-events-none opacity-50 cursor-not-allowed'}`}>
            <section className="flex gap-2 items-center">
                <CircleCheck className={`stroke-1 stroke-gray-300 ${isCompleted && 'fill-green-300 stroke-black!'}`} size={18}/>
                <h4>{step}</h4>
            </section>
            <Link href={destination}>
                <ChevronRight size={16}/>
            </Link>
        </div>
    )
}

export default StepLine
