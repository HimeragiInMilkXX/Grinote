import { REWARD_DAY_TIMEZONE } from "@/lib/rewards/config";

const dateTimeFmt = new Intl.DateTimeFormat( "ja-JP", { timeZone: REWARD_DAY_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit" } );
const dateFmt = new Intl.DateTimeFormat( "ja-JP", { timeZone: REWARD_DAY_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" } );

/** "2026/11/24(火) 14:05" in the reward day time zone (same on server and client). */
export const formatDateTime = ( iso: string ) => dateTimeFmt.format( new Date( iso ) );

export const formatDate = ( iso: string ) => dateFmt.format( new Date( iso ) );

/** "1時間5分", "12分", "45秒", or `emptyLabel` for 0 / invalid. */
export function formatMinutes( minutes: number, emptyLabel = "未設定" ) {

    if( !Number.isFinite( minutes ) || minutes <= 0 ) return emptyLabel;

    if( minutes < 1 ) return `${ Math.round( minutes * 60 ) }秒`;

    // round first, so 59.6 min is "1時間", never "60分"
    const total = Math.round( minutes );
    const h = Math.floor( total / 60 );
    const m = total % 60;

    if( h === 0 ) return `${ m }分`;

    return m ? `${ h }時間${ m }分` : `${ h }時間`;

}
