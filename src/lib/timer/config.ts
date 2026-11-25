import type { TimerConfig, TimerMode } from "./types";

const MIN = 60_000;

/** Timer rules. Durations in ms. Client-safe (the break overrun grace is server-only: ./server-config.ts). */
export const TIMER_CONFIG = {
    pomodoro: { workMs: 25 * MIN, shortBreakMs: 5 * MIN, longBreakMs: 15 * MIN, longBreakEvery: 4 },
    deep: { workMs: 50 * MIN, breakMs: 10 * MIN },
    starter: { workMs: 10 * MIN },
    flowtime: { defaultSuggestMin: 50, suggestOptionsMin: [ 25, 50, 90, 120 ] as readonly number[], breakMs: 10 * MIN },
    /** timer changes per task before every further change resets the timer stats */
    freeChanges: 3,
    /** a custom break notifies the user every … */
    customBreakNoticeMs: 5 * MIN,
    /** how early (ms) the client may report the end of a countdown (clock drift) */
    dueToleranceMs: 2_000,
    pauseReasonMaxLength: 200,
} as const;

export const FREE_TIMER_CHANGES = TIMER_CONFIG.freeChanges;

export function normalizeTimerConfig( mode: TimerMode, config?: TimerConfig | null ): TimerConfig {

    if( mode !== "flowtime" ) return {};

    const raw = Number( config?.flowSuggestMin );
    const flowSuggestMin = Number.isFinite( raw ) && raw >= 5 && raw <= 240 ? Math.round( raw ) : TIMER_CONFIG.flowtime.defaultSuggestMin;

    return { flowSuggestMin };

}

export interface TimerModeInfo {
    label: string;
    short: string;
    pattern: string;
    intro: string;
    features: string[];
    can: string[];
    cannot: string[];
}

/** Japanese copy for the picker, badges and summaries. */
export const TIMER_MODE_INFO: Record<TimerMode, TimerModeInfo> = {
    pomodoro: {
        label: "ポモドーロ",
        short: "25/5",
        pattern: "25分集中 → 5分休憩（4回ごとに15分休憩）",
        intro: "短い集中と休憩を繰り返す定番のリズム。集中が続きにくい日や、細かく進めたいタスクに。",
        features: [ "25分のカウントダウン", "終わると休憩するか確認", "4セッションごとに15分の長い休憩" ],
        can: [ "予定の休憩をスキップして次のセッションへ", "いつでも休憩・一時停止・完成", "休憩中にタイマーを変更" ],
        cannot: [ "セッション中のタイマー変更", "途中で休憩したセッションは長い休憩までの4回に数えない" ],
    },
    deep: {
        label: "50/10 ディープフォーカス",
        short: "50/10",
        pattern: "50分集中 → 10分休憩",
        intro: "長めに深く集中したいときに。まとまった作業や考える仕事に向いています。",
        features: [ "50分のカウントダウン", "終わると10分休憩するか確認" ],
        can: [ "途中で休憩しても、残りの時間から再開", "予定の休憩をスキップ", "休憩中にタイマーを変更" ],
        cannot: [ "セッション中のタイマー変更" ],
    },
    starter: {
        label: "10分スターター",
        short: "10分",
        pattern: "まず10分だけ → 続けるか決める",
        intro: "やる気が出ないときに、まず10分だけ手をつけるためのタイマー。10分後に続けるか選べます。",
        features: [ "10分のカウントダウン、その後はカウントアップ", "10分後に続ける・やめるを確認" ],
        can: [ "10分後、別のタイマーに切り替えて続ける（変更回数に数えない）", "やめる場合は休憩・別のタイマー・諦めるを選べる" ],
        cannot: [ "10分を過ぎたあと、タイマーを変えずに作業を続けること" ],
    },
    flowtime: {
        label: "フロータイム",
        short: "自由",
        pattern: "カウントアップ、休みたいときに休む",
        intro: "時間を区切らず、自分の流れで集中。一定時間ごとに休憩を提案しますが、強制はしません。",
        features: [ "カウントアップ", "設定した時間ごとに10分休憩を提案", "休憩後はまた0からカウントアップ" ],
        can: [ "提案を無視して作業を続ける", "いつでも休憩・一時停止・完成", "休憩中にタイマーを変更" ],
        cannot: [ "セッション中のタイマー変更" ],
    },
};

export const timerModeLabel = ( mode: TimerMode ) => TIMER_MODE_INFO[ mode ]?.label ?? mode;
