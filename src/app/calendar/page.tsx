import WeeklyCalendar from "@/components/calendar/weekly-calendar";
import { buttonVariants } from "@/components/ui/button";
import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { getCalendarData } from "./serverActions";

const CalendarPage = async () => {

    const { weeks, weeksAround, legend } = await getCalendarData();

    return (

        <div className="flex flex-col gap-5">

            <section className="flex items-center gap-2">
                <Link href="/dashboard" className={buttonVariants( { variant: "ghost", size: "icon" } )} aria-label="ダッシュボードに戻る" title="ダッシュボードに戻る">
                    <ArrowLeft/>
                </Link>
                <h2 className="text-xl font-medium"> カレンダー </h2>
            </section>

            { legend.length === 0 ? (

                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
                    <p className="text-sm text-muted-foreground"> まだプロジェクトがありません。プロジェクトを作ると、取り組む曜日がここに表示されます。 </p>
                    <Link href="/project/new/goal" className={buttonVariants( { variant: "secondary" } )}> <Plus/> プロジェクトを作成 </Link>
                </div>

            ) : (

                <WeeklyCalendar weeks={weeks} initialIndex={weeksAround} legend={legend}/>

            )}

        </div>

    );

};

export default CalendarPage;
