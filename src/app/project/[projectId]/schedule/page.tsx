import ScheduleBoard from "@/components/project/schedule/schedule-board";
import { describeScheduleError } from "@/lib/schedule/errors";
import { loadScheduleView, scheduleWeeksOf } from "@/lib/schedule/data";
import { createClient } from "@/utils/supabase/server";
import { CalendarDays } from "lucide-react";
import { notFound } from "next/navigation";

const ProjectSchedulePage = async ( { params }: PageProps<"/project/[projectId]/schedule"> ) => {

    const { projectId } = await params;
    const supabase = await createClient();

    let view;
    let loadError: string | null = null;

    try {
        view = await loadScheduleView( supabase, projectId );
    } catch( e ) {
        console.error( "[schedule] page", e instanceof Error ? e.message : e );
        loadError = describeScheduleError( e );
    }

    if( !loadError && !view ) notFound();

    return (
        <div className="flex h-[90vh] w-full justify-center overflow-y-auto">
            <div className="flex w-full max-w-6xl flex-col gap-4 px-4 py-2 *:shrink-0">
                <div className="flex flex-col gap-1">
                    <h1 className="flex items-center gap-2 text-xl font-semibold"><CalendarDays className="size-6"/> スケジュール </h1>
                    <p className="text-sm text-muted-foreground"> これからの日に、ゴールツリーのタスクを自分で割り当てます。AIに手伝ってもらいたいときはアシスタントに頼んでください。 </p>
                </div>
                { view
                    ? <ScheduleBoard initialView={view} { ...scheduleWeeksOf( view ) }/>
                    : <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground"> { loadError } </p> }
            </div>
        </div>
    );

};

export default ProjectSchedulePage;
