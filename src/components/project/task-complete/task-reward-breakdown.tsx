import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { TaskRewardBreakdown } from "@/lib/rewards/breakdown";

type Row = {
    key: string;
    label: string;
    detail: string;
    factor: number;
    /** 0..1: how close this bonus is to its maximum */
    fill: number;
    maxBonus: number;
    note?: string;
};

const pct = ( n: number ) => `${ Math.round( n * 1000 ) / 10 }%`;
const x2 = ( n: number ) => n.toFixed( 2 );

function formatMinutes( minutes: number ) {

    if( minutes >= 60 ) {
        const h = Math.floor( minutes / 60 );
        const m = Math.round( minutes % 60 );
        return m ? `${h}時間${m}分` : `${h}時間`;
    }

    if( minutes >= 1 ) return `${ Math.round( minutes * 10 ) / 10 }分`;

    return `${ Math.round( minutes * 60 ) }秒`;

}

function buildRows( b: TaskRewardBreakdown ): Row[] {

    const c = b.config;
    const i = b.inputs;
    const f = b.factors;

    const hasTime = i.estimatedMinutes > 0 && i.actualMinutes > 0;
    const ratio = hasTime ? i.estimatedMinutes / i.actualMinutes : 0;

    return [
        {
            key: "time",
            label: "時間ボーナス",
            detail: hasTime
                ? `予定 ${ formatMinutes( i.estimatedMinutes ) } ÷ 実際 ${ formatMinutes( i.actualMinutes ) } = 比率 ${ x2( ratio ) }${ ratio > c.timeRatioCap ? ` → 上限 ${ c.timeRatioCap }` : "" }`
                : i.estimatedMinutes <= 0 ? "予定時間が未設定のため、時間ボーナスはありません" : "計測時間がないため、時間ボーナスはありません",
            factor: f.timeFactor,
            fill: hasTime ? Math.min( ratio, c.timeRatioCap ) / c.timeRatioCap : 0,
            maxBonus: c.timeBonusWeight * c.timeRatioCap,
            note: hasTime ? `1 + ${ c.timeBonusWeight } × ${ x2( Math.min( ratio, c.timeRatioCap ) ) }` : undefined,
        },
        {
            key: "project",
            label: "連続日数ボーナス",
            detail: `${ i.projectStreak }日連続（${ c.projectStreakDaysForMaxBonus }日で最大）`,
            factor: f.projectStreakFactor,
            fill: Math.min( i.projectStreak, c.projectStreakDaysForMaxBonus ) / c.projectStreakDaysForMaxBonus,
            maxBonus: c.projectStreakMaxBonus,
        },
        {
            key: "task",
            label: "連続タスクボーナス",
            detail: `今日この前に ${ i.taskStreak }件連続で完了（${ c.taskStreakTasksForMaxBonus }件で最大）`,
            factor: f.taskStreakFactor,
            fill: Math.min( i.taskStreak, c.taskStreakTasksForMaxBonus ) / c.taskStreakTasksForMaxBonus,
            maxBonus: c.taskStreakMaxBonus,
        },
        {
            key: "ai",
            label: "AI評価ボーナス",
            detail: i.ai.source === "ai" && i.ai.score !== null
                ? `AIレビュー スコア ${ i.ai.score } / ${ c.aiScoreMax }`
                : "AIレビューは準備中です（ボーナスなし）",
            factor: f.aiFactor,
            fill: i.ai.source === "ai" && i.ai.score !== null ? Math.min( Math.max( i.ai.score, 0 ), c.aiScoreMax ) / c.aiScoreMax : 0,
            maxBonus: c.aiScoreMaxBonus,
        },
        {
            key: "character",
            label: "キャラ成長ボーナス",
            detail: `成長段階 ${ i.growthStage } / ${ i.maxStage }（獲得前の段階）`,
            factor: f.characterFactor,
            fill: Math.min( Math.max( i.growthStage, 0 ), i.maxStage ) / i.maxStage,
            maxBonus: c.growthStageMaxBonus,
        },
    ];

}

/** Shows how a task's XP was calculated, from the snapshot stored at completion. */
const TaskRewardBreakdownCard = ( { breakdown }: { breakdown: TaskRewardBreakdown } ) => {

    const rows = buildRows( breakdown );
    const base = breakdown.config.baseXp;

    // XP after each factor is applied, for the "= 70.0" running totals
    const running = rows.reduce<number[]>( ( acc, row ) => [ ...acc, ( acc.at( -1 ) ?? base ) * row.factor ], [] );

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="flex items-baseline justify-between gap-3">
                    <span>獲得XPの内訳</span>
                    <span className="text-2xl font-bold tabular-nums text-green-600">+{ breakdown.awardedXp } XP</span>
                </CardTitle>
                <CardDescription>
                    基本XPに各ボーナスの倍率を掛けて、最後に一度だけ四捨五入します。
                    { breakdown.after.level > breakdown.before.level && ` Lv.${ breakdown.before.level } → Lv.${ breakdown.after.level }` }
                </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-3">

                <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">基本XP</span>
                    <span className="tabular-nums">{ base }</span>
                </div>

                {
                    rows.map( ( row, index ) => {

                        return (
                            <div key={row.key} className="flex flex-col gap-1">
                                <div className="flex items-baseline justify-between gap-3 text-sm">
                                    <span className="font-medium">{ row.label }</span>
                                    <span className="tabular-nums">
                                        <span className={ row.factor > 1 ? "font-semibold text-green-600" : "text-muted-foreground" }>×{ x2( row.factor ) }</span>
                                        <span className="ml-2 text-xs text-muted-foreground">= { running[index].toFixed( 1 ) }</span>
                                    </span>
                                </div>
                                <Progress value={ row.fill * 100 } className="w-full" aria-label={`${ row.label } (最大 +${ pct( row.maxBonus ) })`}/>
                                <p className="text-xs text-muted-foreground">
                                    { row.detail }
                                    { row.note && <span className="ml-1">（{ row.note }）</span> }
                                    <span className="ml-1">最大 +{ pct( row.maxBonus ) }</span>
                                </p>
                            </div>
                        );

                    })
                }

                <div className="mt-1 rounded-md bg-muted px-3 py-2 font-mono text-xs leading-relaxed break-words">
                    { base } × { rows.map( r => x2( r.factor ) ).join( " × " ) } = { breakdown.rawXp.toFixed( 2 ) } → <span className="font-bold">{ breakdown.awardedXp } XP</span>
                </div>

                <p className="text-[11px] text-muted-foreground">計算式 v{ breakdown.formulaVersion }</p>

            </CardContent>
        </Card>
    )

}

export default TaskRewardBreakdownCard
