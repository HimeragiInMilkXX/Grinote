import { DurationObject } from "@/types/global";
import { differenceInCalendarWeeks } from "date-fns"
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

dayjs.extend(duration);

export function stringify( value: unknown ) {

    return String( value || '' );

}

/** Human-readable message for an unknown thrown value. */
export function errorMessage( e: unknown ): string {

    if( e instanceof Error ) return e.message;
    if( typeof e === "string" ) return e;
    return String( e );

}

const pad2 = ( value: number ) => String( value ).padStart( 2, "0" );

export function intervalToSeconds( value: DurationObject ) {

    return value.hours * 3600 + value.minutes * 60 + value.seconds;

}

export function durationObjectToInterval( duration: DurationObject ): string {

    return `${pad2(duration.hours)}:${pad2(duration.minutes)}:${pad2(duration.seconds)}`;

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

    // Monday = 1 ... Sunday = 7
    return date.getDay() || 7;

}

export function getCalenderWeekDifference( start: Date, end: Date ) {

    const week = differenceInCalendarWeeks( end, start, { weekStartsOn: 1 } );

    return week + 1;

}

export function getMsFormatted( ms: number ) {

    const d = dayjs.duration( ms );

    // asHours() so durations of a day or longer don't wrap back to 0h
    const h = Math.floor( d.asHours() );

    const hours = pad2( h );
    const minutes = pad2( d.minutes() );
    const seconds = pad2( d.seconds() );

    const str = "".concat(
        h > 0 ? hours + "h" : "",
        d.minutes() > 0 ? minutes + "m" : "",
        d.seconds() > 0 ? seconds + "s" : "" )

    return { hours, minutes, seconds, str }

}

export function isXpGained( xp_change: number ): boolean {

    return xp_change > 0;

}

export function timestampToLocalDateTime( timestampString: string ) {

    // toISOString() is UTC, so format in local time instead
    const d = dayjs( timestampString );

    return { date: d.format( "YYYY-MM-DD" ), time: d.format( "HH:mm:ss" ) }

}

export function isBetween( value: number, min: number, max: number ) {

    return value >= min && value < max;

}

export function clamp( value: number, min: number, max: number ): number {

    const lower = Math.min( min, max );
    const upper = Math.max( min, max );

    return Math.min( Math.max( value, lower ), upper );

}
