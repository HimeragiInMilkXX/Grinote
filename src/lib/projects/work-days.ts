/**
 * Project work days are stored as ISO weekday numbers: 1 = Monday ... 7 = Sunday,
 * sorted and unique (`projects.work_days smallint[]`, with a CHECK constraint in the DB).
 */

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const WEEKDAYS: ReadonlyArray<{ value: Weekday; label: string; en: string }> = [
    { value: 1, label: "月", en: "Monday" },
    { value: 2, label: "火", en: "Tuesday" },
    { value: 3, label: "水", en: "Wednesday" },
    { value: 4, label: "木", en: "Thursday" },
    { value: 5, label: "金", en: "Friday" },
    { value: 6, label: "土", en: "Saturday" },
    { value: 7, label: "日", en: "Sunday" },
];

export function isWeekday( value: unknown ): value is Weekday {

    return typeof value === "number" && Number.isInteger( value ) && value >= 1 && value <= 7;

}

/** Dedupes, sorts and drops anything that isn't 1-7. */
export function normalizeWorkDays( days: readonly unknown[] | null | undefined ): Weekday[] {

    if( !Array.isArray( days ) ) return [];

    return [ ...new Set( days.filter( isWeekday ) ) ].sort( ( a, b ) => a - b );

}

/** ISO weekday of a date (Monday = 1 ... Sunday = 7), in local time. */
export function isoWeekday( date: Date ): Weekday {

    return ( date.getDay() || 7 ) as Weekday;

}

export function isWorkDay( workDays: readonly number[] | null | undefined, date: Date ): boolean {

    return Array.isArray( workDays ) && workDays.includes( isoWeekday( date ) );

}

export function workDayNames( workDays: readonly unknown[] | null | undefined, lang: "en" | "ja" = "en" ): string[] {

    const days = normalizeWorkDays( workDays );

    return WEEKDAYS.filter( day => days.includes( day.value ) ).map( day => lang === "en" ? day.en : day.label );

}

export function sameWorkDays( a: readonly unknown[] | null | undefined, b: readonly unknown[] | null | undefined ): boolean {

    const x = normalizeWorkDays( a );
    const y = normalizeWorkDays( b );

    return x.length === y.length && x.every( ( day, i ) => day === y[i] );

}
