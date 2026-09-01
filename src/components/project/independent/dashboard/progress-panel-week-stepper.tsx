"use client"

import { ChevronLeft, ChevronRight } from 'lucide-react';

type Props = {

    className?: string;
    thisWeek: number;
    week: number;
    switchWeek: ( by: number ) => void;

}

const ProgressPanelWeekStepper = ( { className = "", week, switchWeek, thisWeek }: Props ) => {

    return (
        <section className={`${className} items-center flex gap-3 select-none relative`}>
            <ChevronLeft onClick={() => switchWeek( -1 )} className={`cursor-pointer ${week - 1 <= 0 && 'pointer-events-none opacity-50'}`}/>
            <h3 className='relative top-[-0.1px]'> Week {week} </h3>
            <ChevronRight onClick={() => switchWeek( 1 )} className={`cursor-pointer ${week + 1 > thisWeek + 1 && 'pointer-events-none opacity-50'}`}/>
        </section>
    )
}

export default ProgressPanelWeekStepper
