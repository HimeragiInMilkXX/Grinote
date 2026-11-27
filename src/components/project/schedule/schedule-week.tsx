import { isWorkDayKey } from "@/lib/next-action/schedule";
import { WEEKDAYS } from "@/lib/projects/work-days";
import { projectColorStyle } from "@/lib/projects/colors";
import type { ScheduleView } from "@/lib/schedule/data";
import { dayTotal, entriesForDay, weekDayKeys } from "@/lib/schedule/days";
import { cn } from "@/lib/utils";
import { AlertTriangle, Check, Flag, Repeat } from "lucide-react";
import type { ReactNode } from "react";

const MAX_SHOWN = 4;

const dayNumber = ( key: string ) => Number( key.slice( 8, 10 ) );
const monthNumber = ( key: string ) => Number( key.slice( 5, 7 ) );

/** Past days and days after the goal date. */
const MUTED_DAY = "cursor-default border-dashed bg-muted/30 text-muted-foreground opacity-60";

type DayCellProps = { readOnly: boolean; onClick: () => void; label: string; className: string; children: ReactNode };

/** A plannable day is a button that opens its sheet; a read-only day is plain content. */
const DayCell = ( { readOnly, onClick, label, className, children }: DayCellProps ) => readOnly
    ? <div aria-label={label} role="group" className={className}>{ children }</div>
    : <button type="button" onClick={onClick} aria-label={label} className={className}>{ children }</button>;

/**
 * One week of the schedule: 7 day cells (one row per day on phones). Work days are tinted with
 * the project color; other days stay plain but can still be planned. Past days and days after the
 * goal date are muted and can't be opened (an after-goal day that still holds entries, e.g. after
 * the goal was moved earlier, stays openable so they can be moved or removed).
 */
const ScheduleWeek = ( { startKey, view, onSelectDay }: { startKey: string; view: ScheduleView; onSelectDay: ( key: string ) => void } ) => {

    const color = projectColorStyle( view.projectColor );

    return (

        <ol className="grid grid-cols-1 gap-2 md:grid-cols-7">

            { weekDayKeys( startKey ).map( ( key, index ) => {

                const weekday = WEEKDAYS[ index ];
                const isToday = key === view.todayKey;
                const isPast = key < view.todayKey;
                // same rule as isPickableDay: an overdue goal doesn't limit anything
                const afterGoal = !!view.goalKey && view.goalKey >= view.todayKey && key > view.goalKey;
                const muted = isPast || afterGoal;
                const workDay = isWorkDayKey( key, view.workDays );
                const entries = entriesForDay( view.entries, key, view.todayKey );
                const readOnly = isPast || ( afterGoal && entries.length === 0 );
                const total = dayTotal( key, entries, view.goalMinutes );
                const showMonth = index === 0 || dayNumber( key ) === 1;
                const label = `${monthNumber( key )}月${dayNumber( key )}日（${weekday.label}）${ isToday ? " 今日" : "" }${ afterGoal ? " 目標日以降" : workDay ? " 作業日" : "" }、予定${entries.length}件`;

                return (

                    <li key={key} aria-current={ isToday ? "date" : undefined }>
                        <DayCell
                            readOnly={readOnly}
                            onClick={ () => onSelectDay( key ) }
                            label={label}
                            className={cn(
                                "flex w-full gap-3 rounded-xl border p-2 text-left transition-colors outline-none md:min-h-48 md:flex-col md:gap-2",
                                muted
                                    ? cn( MUTED_DAY, !readOnly && "cursor-pointer focus-visible:ring-3 focus-visible:ring-ring/50" )
                                    : cn( "focus-visible:ring-3 focus-visible:ring-ring/50", workDay ? cn( color.soft, "border-solid" ) : "bg-card hover:bg-muted/60" ),
                                isToday && "ring-2 ring-primary/50",
                            )}
                        >

                            <div className="flex w-12 shrink-0 flex-col items-center justify-center md:w-full md:flex-row md:justify-between md:px-1">
                                <span className="text-xs"> { weekday.label } </span>
                                <span className={cn( "grid min-w-7 place-items-center rounded-full px-1 text-sm font-semibold tabular-nums", isToday && "bg-primary text-primary-foreground" )}>
                                    { showMonth ? `${monthNumber( key )}/${dayNumber( key )}` : dayNumber( key ) }
                                </span>
                            </div>

                            <div className="flex min-w-0 flex-1 flex-col gap-1">

                                { key === view.goalKey && <span className="flex items-center gap-1 text-[0.7rem] font-medium"><Flag className="size-3"/> 目標日</span> }

                                <ul className="flex flex-col gap-0.5">
                                    { entries.slice( 0, MAX_SHOWN ).map( e => (
                                        <li key={e.id} className={cn(
                                            "flex items-center gap-1 rounded-md bg-background/80 px-1.5 py-0.5 text-[0.72rem]",
                                            !muted && "text-foreground",
                                            e.state === "done" && "text-muted-foreground line-through",
                                            e.state === "stale" && "opacity-60",
                                        )}>
                                            { e.state === "done" ? <Check className="size-3 shrink-0 text-green-700"/> : e.isLoop ? <Repeat className="size-3 shrink-0"/> : null }
                                            <span className="truncate">{ e.name }</span>
                                            { e.state === "carried" && <span className="ml-auto shrink-0 text-[0.6rem] text-amber-700"> 持越 </span> }
                                        </li>
                                    ))}
                                    { entries.length > MAX_SHOWN && <li className="px-1.5 text-[0.7rem] text-muted-foreground"> 他{ entries.length - MAX_SHOWN }件 </li> }
                                    { entries.length === 0 && !muted && <li className="px-1 text-[0.7rem] text-muted-foreground/80"> 予定なし </li> }
                                </ul>

                                { total.minutes > 0 && (
                                    <span className={cn( "mt-auto flex items-center gap-1 px-1 text-[0.7rem] tabular-nums", total.over ? "font-medium text-amber-700 dark:text-amber-300" : "text-muted-foreground" )}>
                                        { total.over && <AlertTriangle className="size-3"/> }
                                        { total.goalMinutes ? `${total.minutes} / ${total.goalMinutes}分` : `${total.minutes}分` }
                                    </span>
                                )}

                            </div>

                        </DayCell>
                    </li>

                );

            })}

        </ol>

    );

};

export default ScheduleWeek;
