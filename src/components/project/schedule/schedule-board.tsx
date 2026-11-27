"use client";

import { formatWeekRange } from "@/components/calendar/weekly-calendar";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { assistantPageContextAtom } from "@/atoms/assistant_page_context_atom";
import { scheduleVersionAtom } from "@/atoms/schedule_atoms";
import { workDayNames } from "@/lib/projects/work-days";
import { applyScheduleChanges, getScheduleView, type ScheduleActionResult } from "@/lib/schedule/actions";
import type { ScheduleView } from "@/lib/schedule/data";
import { addDaysToKey } from "@/lib/rewards/streaks";
import { cn } from "@/lib/utils";
import { useAtomValue, useSetAtom } from "jotai";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import ScheduleDaySheet from "./schedule-day-sheet";
import ScheduleWeek from "./schedule-week";

type Props = {
    initialView: ScheduleView;
    weeks: string[];
    currentIndex: number;
};

function relativeLabel( offset: number ) {

    if( offset === 0 ) return "今週";
    if( offset === -1 ) return "先週";
    if( offset === 1 ) return "来週";
    return offset < 0 ? `${-offset}週間前` : `${offset}週間後`;

}

/**
 * The project's schedule: one week at a time (swipe / drag, buttons or ←/→). Clicking a day
 * opens its sheet to add, move or remove tasks. Every change is saved right away.
 */
const ScheduleBoard = ( { initialView, weeks, currentIndex }: Props ) => {

    const [ view, setView ] = useState( initialView );
    const [ api, setApi ] = useState<CarouselApi>();
    const [ index, setIndex ] = useState( currentIndex );
    const [ openDay, setOpenDay ] = useState<string | null>( null );
    const [ pending, startTransition ] = useTransition();

    // the assistant knows the page and the open day
    const setPageContext = useSetAtom( assistantPageContextAtom );
    useEffect( () => {
        setPageContext( { page: "schedule", day: openDay ?? undefined } );
    }, [ openDay, setPageContext ] );
    useEffect( () => () => setPageContext( { page: "other" } ), [ setPageContext ] );

    // reload when the schedule changed elsewhere (the assistant's proposal card)
    const version = useAtomValue( scheduleVersionAtom );
    const firstVersion = useRef( version );
    useEffect( () => {
        if( version === firstVersion.current ) return;
        getScheduleView( initialView.projectId ).then( res => { if( res.ok ) setView( res.view ); } );
    }, [ version, initialView.projectId ] );

    useEffect( () => {
        if( !api ) return;
        const onSelect = () => setIndex( api.selectedScrollSnap() );
        onSelect();
        api.on( "select", onSelect ).on( "reInit", onSelect );
        return () => { api.off( "select", onSelect ).off( "reInit", onSelect ) };
    }, [ api ] );

    /** resolves true when the change was saved */
    const apply = ( run: () => Promise<ScheduleActionResult>, success: string ) => new Promise<boolean>( resolve => startTransition( async () => {
        const res = await run();
        if( res.view ) setView( res.view );
        if( !res.ok ) {
            toast.error( res.message, { description: res.problems?.join( "\n" ) } );
            resolve( false );
            return;
        }
        toast.success( success, res.warnings.length ? { description: res.warnings.join( "\n" ) } : undefined );
        resolve( true );
    } ) );

    const projectId = view.projectId;
    const onAdd = ( dayKey: string, picks: { node_id: string; count: number }[] ) =>
        apply( () => applyScheduleChanges( projectId, { add: picks.map( p => ( { ...p, date: dayKey } ) ) } ), "予定を追加しました" );
    const onMove = ( itemId: string, toKey: string ) =>
        apply( () => applyScheduleChanges( projectId, { move: [ { item_id: itemId, date: toKey } ] } ), "予定を移動しました" );
    const onRemove = ( itemId: string ) =>
        apply( () => applyScheduleChanges( projectId, { remove: [ { item_id: itemId } ] } ), "予定を外しました" );

    const startKey = weeks[ index ] ?? weeks[ currentIndex ];
    const isCurrent = index === currentIndex;

    return (

        <div className="flex flex-col gap-4">

            <div className="flex flex-wrap items-center justify-between gap-2">

                <div className="flex min-w-0 flex-col">
                    <span className="text-xs text-muted-foreground" aria-hidden> { relativeLabel( index - currentIndex ) } </span>
                    <h2 className="text-base font-medium md:text-lg" aria-live="polite"> { formatWeekRange( startKey, addDaysToKey( startKey, 6 ) ) } </h2>
                </div>

                <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="sm" onClick={ () => api?.scrollTo( currentIndex ) } disabled={isCurrent} className={cn( isCurrent && "invisible" )}>
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

            <Carousel setApi={setApi} opts={{ startIndex: currentIndex, align: "start", duration: 22 }} aria-label="週間スケジュール" tabIndex={0} className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                <CarouselContent className="ml-0 items-start" style={{ transform: `translate3d(${ -100 * currentIndex }%, 0, 0)` }}>
                    { weeks.map( ( w, i ) => (
                        <CarouselItem key={w} className="p-1" aria-label={formatWeekRange( w, addDaysToKey( w, 6 ) )} aria-hidden={ i !== index } inert={ i !== index }>
                            {/* only nearby weeks render their cells */}
                            { Math.abs( i - index ) <= 1 ? <ScheduleWeek startKey={w} view={view} onSelectDay={setOpenDay}/> : <div className="h-48"/> }
                        </CarouselItem>
                    ))}
                </CarouselContent>
            </Carousel>

            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="凡例">
                <li> 作業日：{ view.workDays.length ? workDayNames( view.workDays, "ja" ).join( "・" ) : "毎日" } </li>
                <li> 1日の目標：{ view.goalMinutes ? `${view.goalMinutes}分` : "未設定" } </li>
                <li> 日付を押すと予定を追加・変更できます </li>
                <li> 完了した予定は変更できません </li>
            </ul>

            <ScheduleDaySheet
                view={view}
                dayKey={openDay}
                pending={pending}
                onClose={ () => setOpenDay( null ) }
                onAdd={onAdd}
                onMove={onMove}
                onRemove={onRemove}
            />

        </div>

    );

};

export default ScheduleBoard;
