import type { CalendarWeek } from "@/lib/calendar/week";
import { WEEKDAYS } from "@/lib/projects/work-days";
import { cn } from "@/lib/utils";
import CalendarEntryBlock from "./calendar-entry";

const dayNumber = ( key: string ) => Number( key.slice( 8, 10 ) );
const monthNumber = ( key: string ) => Number( key.slice( 5, 7 ) );

/**
 * One week: 7 columns from md up, one row per day on phones.
 */
const WeekGrid = ( { week }: { week: CalendarWeek } ) => {

    return (

        <ol className="grid grid-cols-1 gap-2 md:grid-cols-7">

            { week.days.map( ( day, index ) => {

                const weekday = WEEKDAYS[ day.weekday - 1 ];
                // show the month on the first column and on the 1st of a month
                const showMonth = index === 0 || dayNumber( day.key ) === 1;
                const weekend = day.weekday >= 6;

                return (

                    <li
                        key={day.key}
                        aria-current={ day.isToday ? "date" : undefined }
                        aria-label={`${monthNumber( day.key )}月${dayNumber( day.key )}日（${weekday.label}）${ day.isToday ? " 今日" : "" }`}
                        className={cn(
                            "flex gap-3 rounded-xl border bg-card p-2 md:min-h-40 md:flex-col md:gap-2",
                            day.isToday && "border-primary ring-2 ring-primary/30",
                            day.isPast && "bg-muted/40",
                        )}
                    >

                        <div className={cn(
                            "flex w-12 shrink-0 flex-col items-center justify-center md:w-auto md:flex-row md:justify-between md:px-1",
                            day.isPast && "text-muted-foreground",
                        )}>
                            <span className={cn( "text-xs", weekend && !day.isPast && "text-rose-600" )}> { weekday.label } </span>
                            <span className={cn(
                                "grid min-w-7 place-items-center rounded-full px-1 text-sm font-semibold tabular-nums",
                                day.isToday && "bg-primary text-primary-foreground",
                            )}>
                                { showMonth ? `${monthNumber( day.key )}/${dayNumber( day.key )}` : dayNumber( day.key ) }
                            </span>
                        </div>

                        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 md:justify-start">

                            { day.entries.length > 0 ? day.entries.map( entry => (
                                <CalendarEntryBlock key={entry.projectId} entry={entry} isPast={day.isPast}/>
                            )) : (
                                <span className="text-xs text-muted-foreground/70 md:hidden"> 予定なし </span>
                            )}

                        </div>

                    </li>

                );

            })}

        </ol>

    );

};

export default WeekGrid;
