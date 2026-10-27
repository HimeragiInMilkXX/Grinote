"use client";

import { getCalenderWeekDifference } from '@/utils/utils';
import { useCallback, useState } from 'react';
import ProgressPanelDayCard from './progress-panel-day-card';
import { addWeeks, eachDayOfInterval, endOfWeek, startOfWeek } from 'date-fns';
import ProgressPanelWeekStepper from './progress-panel-week-stepper';

const WEEKDAYS = [ "月", "火", "水", "木", "金", "土", "日" ]

interface Props {

    project: Project;

}

const ProjectDashboardProgressPanel = ( { project }: Props ) => {

    const today = new Date();

    const projectStartedDate = new Date(project.created_at);

    const [ weekDates, setWeekDates ] = useState(
        eachDayOfInterval( {
            start: startOfWeek( today, { weekStartsOn: 1 } ),
            end: endOfWeek( today, { weekStartsOn: 1 } )
        } )
    );

    const thisWeek = getCalenderWeekDifference( projectStartedDate, today );
    const [ week, setWeek ] = useState( getCalenderWeekDifference( projectStartedDate, today ) );

    // Function that pass to stepper to manipulate dashboard progress panel
    const switchWeek = useCallback( ( by: number ) => {

        // Cancel if after changing, week will become 0 or larger than one week from current week
        if( week + by <= 0 || week + by > thisWeek + 1 ) return;

        // Update state and this function will be reproduced with new value
        setWeek( week + by );

        // Update all the weekDates so that each day card get correct data
        setWeekDates(

            weekDates.map( ( date: Date ) => addWeeks( date, by ) )

        )

    }, [week] )

    return (
        <section className='flex gap-1.5 flex-col items-center'>
            {

                project.work_days.map( ( value, i ) => (
                    <ProgressPanelDayCard
                        key={i}
                        today={today}
                        date={weekDates[i]}
                        label={WEEKDAYS[i]}
                        isWorkDay={value}
                        project_id={project.id}
                        startDate={project.created_at}
                    />
                ))

            }
            <ProgressPanelWeekStepper week={week} switchWeek={switchWeek} thisWeek={thisWeek}/>
        </section>
    )

}

export default ProjectDashboardProgressPanel
