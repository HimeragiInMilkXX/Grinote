import { DurationObject } from "@/types/global";
import { differenceInCalendarWeeks } from "date-fns"
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

dayjs.extend(duration);

export function stringify( value: any ) {

    return String( value || '' );

}

export function intervalToSeconds( value: { hours: number, minutes: number, seconds: number } ) {

    return value.hours * 3600 + value.minutes * 60 + value.seconds;

}

export function durationObjectToInterval( duration: DurationObject ): string {

    return `${String(duration.hours).padStart(2, '0')}:${String(duration.minutes).padStart(2, '0')}:${String(duration.seconds).padStart(2, '0')}`;

}

export function intervalToDurationObject( interval: string ): DurationObject  {

    const [ hours, minutes, seconds ] = interval.split( ":" );

    return {

        hours: Number( hours ),
        minutes: Number( minutes ),
        seconds: Number( seconds ),

    }

}

export function getDay( date: Date ) {

    let day = date.getDay();

    if( day == 0 ) day = 7;

    return day;

}

export function getCalenderWeekDifference( start: Date, end: Date ) {

    const week = differenceInCalendarWeeks( end, start, { weekStartsOn: 1 } );

    return week + 1;

}

export function getMsFormatted( ms: number ) {

    const d = dayjs.duration( ms );

    const hours = stringify(d.hours()).padStart( 2, "0" );
    const minutes = stringify(d.minutes()).padStart( 2, "0" );
    const seconds = stringify(d.seconds()).padStart( 2, "0" )

    const str = "".concat(
        d.hours() > 0 ? hours + "h" : "",
        d.minutes() > 0 ? minutes + "m" : "",
        d.seconds() > 0 ? seconds + "s" : "" )

    return { hours, minutes, seconds, str }

}

export function timestampToLocalDateTime( timestampString: string ) {

    const d = new Date( timestampString );

    const localDate = d.toISOString().split('T')[0];
    const localTime = d.toTimeString().split(' ')[0];

    return { date: localDate, time: localTime }

}