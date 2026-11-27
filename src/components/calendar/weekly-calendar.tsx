"use client"

import type { CalendarLegendItem } from "@/app/calendar/serverActions";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import type { CalendarWeek } from "@/lib/calendar/week";
import { projectColorStyle } from "@/lib/projects/colors";
import { cn } from "@/lib/utils";
import { Check, ChevronLeft, ChevronRight, Flag } from "lucide-react";
import { useEffect, useState } from "react";
import WeekGrid from "./week-grid";

type Props = {
    weeks: CalendarWeek[];
    /** index of the current week in `weeks` */
    initialIndex: number;
    legend: CalendarLegendItem[];
};

function parseKey( key: string ) {

    return { y: Number( key.slice( 0, 4 ) ), m: Number( key.slice( 5, 7 ) ), d: Number( key.slice( 8, 10 ) ) };

}

/** "2026年11月23日 – 29日", "2026年11月30日 – 12月6日", "2026年12月28日 – 2027年1月3日" */
export function formatWeekRange( startKey: string, endKey: string ) {

    const a = parseKey( startKey );
    const b = parseKey( endKey );

    const end = a.y !== b.y ? `${b.y}年${b.m}月${b.d}日` : a.m !== b.m ? `${b.m}月${b.d}日` : `${b.d}日`;

    return `${a.y}年${a.m}月${a.d}日 – ${end}`;

}

function relativeLabel( offset: number ) {

    if( offset === 0 ) return "今週";
    if( offset === -1 ) return "先週";
    if( offset === 1 ) return "来週";
    return offset < 0 ? `${-offset}週間前` : `${offset}週間後`;

}

/**
 * Weekly calendar of every project's work days. One carousel slide per week (swipe / drag,
 * buttons or ←/→), limited to the weeks the server built (CALENDAR_WEEKS_AROUND each side).
 */
const WeeklyCalendar = ( { weeks, initialIndex, legend }: Props ) => {

    const [ api, setApi ] = useState<CarouselApi>();
    const [ index, setIndex ] = useState( initialIndex );

    useEffect( () => {

        if( !api ) return;

        const onSelect = () => setIndex( api.selectedScrollSnap() );
        onSelect();
        api.on( "select", onSelect ).on( "reInit", onSelect );

        return () => { api.off( "select", onSelect ).off( "reInit", onSelect ) };

    }, [ api ] );

    const week = weeks[ index ] ?? weeks[ initialIndex ];
    const isCurrent = index === initialIndex;

    return (

        <div className="flex flex-col gap-4">

            <div className="flex flex-wrap items-center justify-between gap-2">

                <div className="flex min-w-0 flex-col">
                    <span className="text-xs text-muted-foreground" aria-hidden> { relativeLabel( week.offset ) } </span>
                    <h3 className="text-base font-medium md:text-lg" aria-live="polite"> { formatWeekRange( week.startKey, week.endKey ) } </h3>
                </div>

                <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="sm" onClick={ () => api?.scrollTo( initialIndex ) } disabled={isCurrent} className={cn( isCurrent && "invisible" )}>
                        今週
                    </Button>
                    <Button variant="outline" size="icon" onClick={ () => api?.scrollPrev() } disabled={ index <= 0 } aria-label="前の週">
                        <ChevronLeft/>
                    </Button>
                    <Button variant="outline" size="icon" onClick={ () => api?.scrollNext() } disabled={ index >= weeks.length - 1 } aria-label="次の週">
                        <ChevronRight/>
                    </Button>
                </div>

            </div>

            <Carousel setApi={setApi} opts={{ startIndex: initialIndex, align: "start", duration: 22 }} aria-label="週間カレンダー" tabIndex={0} className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                {/* server render / before embla starts: already on the current week (embla then owns the transform) */}
                <CarouselContent className="ml-0 items-start" style={{ transform: `translate3d(${ -100 * initialIndex }%, 0, 0)` }}>
                    { weeks.map( w => (
                        <CarouselItem key={w.startKey} className="p-1" aria-label={formatWeekRange( w.startKey, w.endKey )} aria-hidden={ w.offset !== week.offset } inert={ w.offset !== week.offset }>
                            <WeekGrid week={w}/>
                        </CarouselItem>
                    ))}
                </CarouselContent>
            </Carousel>

            <div className="flex flex-col gap-2 text-xs text-muted-foreground">

                <ul className="flex flex-wrap gap-x-4 gap-y-1.5" aria-label="プロジェクト">
                    { [ ...legend ].sort( ( a, b ) => a.name.localeCompare( b.name, "ja" ) ).map( item => (
                        <li key={item.id} className="flex items-center gap-1.5 text-foreground">
                            <span aria-hidden className={cn( "size-2.5 rounded-full", projectColorStyle( item.color ).dot )}/>
                            { item.name }
                        </li>
                    ))}
                </ul>

                <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="凡例">
                    <li className="flex items-center gap-1"><Check size={12} strokeWidth={3}/> 作業済み</li>
                    <li className="flex items-center gap-1"><span aria-hidden className="h-3 w-5 rounded-sm bg-slate-600 opacity-45"/> 未実施</li>
                    <li className="flex items-center gap-1"><span aria-hidden className="h-3 w-5 rounded-sm border border-dashed border-slate-500 bg-slate-50"/> 予定外の作業</li>
                    <li className="flex items-center gap-1"><Flag size={12}/> 目標達成日</li>
                    <li> ブロックを押すとゴールツリーが開きます </li>
                </ul>

            </div>

        </div>

    );

};

export default WeeklyCalendar;
