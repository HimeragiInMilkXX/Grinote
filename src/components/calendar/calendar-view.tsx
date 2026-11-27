"use client";

import type { CalendarData } from "@/app/calendar/serverActions";
import { buildDayPanel, pendingCounts } from "@/lib/calendar/day-panel";
import { useMemo, useState } from "react";
import DayTaskPanel from "./day-task-panel";
import WeeklyCalendar from "./weekly-calendar";

/** Weekly calendar + the panel of the focused day (today until the user picks another day). */
const CalendarView = ( { data }: { data: CalendarData } ) => {

    const [ focusKey, setFocusKey ] = useState( data.todayKey );

    const pending = useMemo( () => pendingCounts( data.scheduleEntries, data.todayKey ), [ data.scheduleEntries, data.todayKey ] );

    const panel = useMemo( () => buildDayPanel( {
        projects: data.panelProjects,
        plans: data.plans,
        entries: data.scheduleEntries,
        focusKey,
        todayKey: data.todayKey,
    } ), [ data, focusKey ] );

    return (
        <>
            <WeeklyCalendar weeks={data.weeks} initialIndex={data.weeksAround} legend={data.legend} selectedKey={focusKey} onSelectDay={setFocusKey} pending={pending}/>
            <DayTaskPanel panel={panel} todayKey={data.todayKey}/>
        </>
    );

};

export default CalendarView;
