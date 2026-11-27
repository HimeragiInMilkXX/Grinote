import type { CalendarEntry } from "@/lib/calendar/week";
import { projectColorStyle } from "@/lib/projects/colors";
import { cn } from "@/lib/utils";
import { Check, Flag } from "lucide-react";
import Link from "next/link";

type Props = {
    entry: CalendarEntry;
    /** the day is before today */
    isPast: boolean;
};

function describe( entry: CalendarEntry, isPast: boolean ) {

    const parts = [ entry.name ];

    if( entry.kind === "extra" ) parts.push( "予定外の日に作業済み" );
    else if( entry.worked ) parts.push( "作業済み" );
    else if( entry.kind === "scheduled" ) parts.push( isPast ? "未実施" : "予定" );

    if( entry.isGoalDay ) parts.push( "目標達成日" );

    return parts.join( " ・ " );

}

/** One project block; opens the project's goal tree to pick and start a task. */
const CalendarEntryBlock = ( { entry, isPast }: Props ) => {

    const style = projectColorStyle( entry.color );
    const missed = entry.kind === "scheduled" && isPast && !entry.worked;
    const label = describe( entry, isPast );

    return (

        <Link
            href={`/project/${entry.projectId}/tree`}
            draggable={false}
            title={label}
            aria-label={`${label}（ゴールツリーを開く）`}
            className={cn(
                "group flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium leading-5 transition-colors outline-none",
                "focus-visible:ring-3 focus-visible:ring-ring/60",
                entry.kind === "scheduled" ? style.solid : cn( "border", style.soft, entry.kind === "extra" && "border-dashed" ),
                missed && "opacity-45 hover:opacity-80",
            )}
        >
            <span className="min-w-0 flex-1 truncate">{ entry.name }</span>
            { entry.worked && <Check aria-hidden size={14} strokeWidth={3} className="shrink-0"/> }
            { entry.isGoalDay && <Flag aria-hidden size={13} className="shrink-0"/> }
        </Link>

    );

};

export default CalendarEntryBlock;
