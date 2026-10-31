import { getRecordsOfDay } from "@/app/project/[projectId]/dashboard/clientActions";
import { OnAirRecord } from "@/types/records";
import { isAfter, isSameDay } from "date-fns";
import { redirect } from "next/navigation";
import { useEffect, useState } from "react";

type Props = {

    today: Date;
    date: Date;
    label: string;
    isWorkDay: boolean;
    project_id: string;
    startDate: Date;

}

const ProgressPanelDayCard = ( { project_id, today, date, label, isWorkDay, startDate }: Props ) => {

    const [ records, setRecords ] = useState<OnAirRecord[]>([])

    // Only fetch records again when the date this card is representing got updated
    useEffect( () => {

        getRecordsOfDay( project_id, date ).then( res => setRecords(res) );

    }, [date])

    return (
        <div className={
            `p-4 w-100 items-center flex justify-start leading-tight bg-gray-200
            ${!isWorkDay && 'opacity-38'} ${ isSameDay( today, date ) && 'box-border [box-shadow:inset_0_0_0_2px_#43ff52] cursor-pointer' }`}
            onClick={() => {

                if( !isSameDay( today, date ) ) return;
                redirect( `/project/${project_id}/tree?isInitialEditMode=false` )

            }}>
            <div className="w-full justify-between flex items-center">

                <p>{label}</p>

                { isSameDay( today, date ) && <p>今日</p> }

                {

                    (isAfter( date, startDate ) || isSameDay( startDate, date )) &&
                        <p className={`${( isWorkDay && records.length <= 0 ) && 'text-red-500'} ${ ( date > today ) && 'hidden' }`}> {records.length}タスク </p>

                }

            </div>
        </div>
    )
}

export default ProgressPanelDayCard
