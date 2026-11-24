import { Card, CardContent } from "@/components/ui/card";
import type { JourneyStats } from "@/lib/journey/history";
import { CalendarDays, CheckCircle2, Clock, Flame, Medal } from "lucide-react";
import type { ReactNode } from "react";
import { formatDate, formatMinutes } from "./format";

function Stat( { icon, label, value }: { icon: ReactNode; label: string; value: string } ) {

    return (
        <div className="flex flex-col gap-1 rounded-2xl bg-muted/60 px-4 py-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">{ icon }{ label }</span>
            <span className="text-xl font-semibold tabular-nums">{ value }</span>
        </div>
    );

}

const JourneyStatsCard = ( { stats }: { stats: JourneyStats } ) => {

    return (
        <Card>
            <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <Stat icon={<Clock className="size-3.5"/>} label="総作業時間" value={ formatMinutes( stats.totalWorkMs / 60000, "0分" ) }/>
                <Stat icon={<CheckCircle2 className="size-3.5"/>} label="完了タスク" value={`${ stats.completedTasks }件`}/>
                <Stat icon={<Flame className="size-3.5"/>} label="現在の連続" value={`${ stats.currentStreak }日`}/>
                <Stat icon={<Medal className="size-3.5"/>} label="最高連続" value={`${ stats.longestStreak }日`}/>
                <Stat icon={<CalendarDays className="size-3.5"/>} label="開始日" value={ formatDate( stats.startedAt ) }/>
            </CardContent>
        </Card>
    );

};

export default JourneyStatsCard;
