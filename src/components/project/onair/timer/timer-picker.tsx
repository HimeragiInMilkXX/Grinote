"use client"

import { cn } from "@/lib/utils";
import { TIMER_CONFIG, TIMER_MODE_INFO } from "@/lib/timer/config";
import { TIMER_MODES, type TimerChoice, type TimerMode } from "@/lib/timer/types";
import { Check, X } from "lucide-react";

interface Props {
    value: TimerChoice;
    onChange: ( choice: TimerChoice ) => void;
    /** modes that can't be picked (e.g. the current one when changing) */
    disabledModes?: TimerMode[];
}

const LAST_CHOICE_KEY = "grinote:last-timer";

/** The last timer the user started with (per browser). */
export function loadLastTimerChoice(): TimerChoice | null {
    try {
        const raw = JSON.parse( localStorage.getItem( LAST_CHOICE_KEY ) ?? "null" );
        if( raw && ( TIMER_MODES as readonly string[] ).includes( raw.mode ) ) return raw as TimerChoice;
    } catch { /* storage blocked or bad JSON */ }
    return null;
}

export function saveLastTimerChoice( choice: TimerChoice ) {
    try { localStorage.setItem( LAST_CHOICE_KEY, JSON.stringify( choice ) ); } catch { /* ignore */ }
}

/** Four timer cards + the selected timer's details (features, できること / できないこと). */
const TimerPicker = ( { value, onChange, disabledModes = [] }: Props ) => {

    const info = TIMER_MODE_INFO[ value.mode ];
    const flowMin = value.config?.flowSuggestMin ?? TIMER_CONFIG.flowtime.defaultSuggestMin;

    return (
        <div className="flex flex-col gap-4">

            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="タイマー">
                {
                    TIMER_MODES.map( mode => {
                        const m = TIMER_MODE_INFO[ mode ];
                        const selected = value.mode === mode;
                        const disabled = disabledModes.includes( mode );
                        return (
                            <button
                                key={mode}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                disabled={disabled}
                                onClick={ () => onChange( mode === "flowtime" ? { mode, config: { flowSuggestMin: flowMin } } : { mode } ) }
                                className={cn(
                                    "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
                                    selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted",
                                    disabled && "cursor-not-allowed opacity-40",
                                )}
                            >
                                <span className="flex w-full items-center justify-between gap-2">
                                    <span className="font-semibold">{m.label}</span>
                                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{m.short}</span>
                                </span>
                                <span className="text-xs text-muted-foreground">{m.pattern}</span>
                            </button>
                        );
                    } )
                }
            </div>

            <div className="flex flex-col gap-3 rounded-lg bg-muted/50 p-3 text-sm">
                <p>{info.intro}</p>

                <ul className="list-disc pl-5 text-muted-foreground">
                    { info.features.map( f => <li key={f}>{f}</li> ) }
                </ul>

                {
                    value.mode === "flowtime" && (
                        <div className="flex flex-col gap-1.5">
                            <span className="text-xs font-medium">休憩を提案するまでの集中時間</span>
                            <div className="flex flex-wrap gap-1.5">
                                {
                                    TIMER_CONFIG.flowtime.suggestOptionsMin.map( min => (
                                        <button
                                            key={min}
                                            type="button"
                                            onClick={ () => onChange( { mode: "flowtime", config: { flowSuggestMin: min } } ) }
                                            className={cn( "rounded-md border px-2.5 py-1 text-xs", flowMin === min ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted" )}
                                        >
                                            { min >= 60 ? `${min / 60}時間` : `${min}分` }
                                        </button>
                                    ) )
                                }
                            </div>
                        </div>
                    )
                }

                <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                        <p className="mb-1 text-xs font-medium">できること</p>
                        <ul className="flex flex-col gap-1 text-xs">
                            { info.can.map( c => <li key={c} className="flex gap-1.5"><Check className="size-3.5 shrink-0 text-emerald-600"/>{c}</li> ) }
                        </ul>
                    </div>
                    <div>
                        <p className="mb-1 text-xs font-medium">できないこと</p>
                        <ul className="flex flex-col gap-1 text-xs">
                            { info.cannot.map( c => <li key={c} className="flex gap-1.5"><X className="size-3.5 shrink-0 text-rose-600"/>{c}</li> ) }
                        </ul>
                    </div>
                </div>

                <p className="text-xs text-muted-foreground">
                    どのタイマーでも、いつでも「休憩する」「一時停止」「完成」ができます。タイマーの変更は休憩中だけ、1タスクにつき{TIMER_CONFIG.freeChanges}回まで（それ以降は変更するたびに記録がリセットされます）。
                </p>
            </div>

        </div>
    );

};

export default TimerPicker;
