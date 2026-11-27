import { Progress } from "@/components/ui/progress";
import { NEXT_ACTION_LABELS, RUBRIC, RUBRIC_KEYS, type JourneyAnalysis } from "@/lib/journey/analysis";
import { VERIFICATION_LABELS } from "@/lib/journey/journal";
import { BadgeCheck, Bot, FileUp, Lightbulb, Mountain, Sparkles, Trophy } from "lucide-react";
import type { ReactNode } from "react";

export const scoreTone = ( score: number ) => score >= 75 ? "text-green-600" : score >= 50 ? "text-amber-600" : "text-orange-600";

export function VerificationBadge( { verification }: { verification: JourneyAnalysis[ "verification" ] } ) {

    return (
        <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
            <BadgeCheck className="size-3"/> { VERIFICATION_LABELS[ verification ] }
        </span>
    );

}

function Section( { icon, title, children }: { icon: ReactNode; title: string; children: ReactNode } ) {

    return (
        <div className="flex flex-col gap-1">
            <p className="flex items-center gap-1.5 text-sm font-semibold">{ icon }{ title }</p>
            <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">{ children }</div>
        </div>
    );

}

/** The AI analysis of one task report (report page result + journey entry). */
const JourneyAnalysisView = ( { analysis }: { analysis: JourneyAnalysis } ) => {

    return (
        <div className="flex flex-col gap-4">

            <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex flex-col">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground"><Bot className="size-3.5"/> AIによる評価（努力重視）</span>
                    <span className={`text-4xl font-bold tabular-nums ${ scoreTone( analysis.score ) }`}>{ analysis.score }<span className="text-base font-normal text-muted-foreground"> / 100</span></span>
                </div>
                <VerificationBadge verification={analysis.verification}/>
            </div>

            <div className="flex flex-col gap-2">
                {
                    RUBRIC_KEYS.map( key => {
                        const item = analysis.rubric[ key ];
                        return (
                            <div key={key} className="flex flex-col gap-1">
                                <div className="flex items-baseline justify-between text-sm">
                                    <span className="font-medium">{ RUBRIC[ key ].label }</span>
                                    <span className="tabular-nums text-muted-foreground">{ item.score } / { item.max }</span>
                                </div>
                                <Progress value={ item.max ? item.score / item.max * 100 : 0 } className="w-full" aria-label={ RUBRIC[ key ].label }/>
                                { item.reason && <p className="text-xs text-muted-foreground">{ item.reason }</p> }
                            </div>
                        );
                    })
                }
            </div>

            <Section icon={<Sparkles className="size-4"/>} title="やったこと・学んだこと">{ analysis.did }</Section>
            { analysis.achieved && <Section icon={<Trophy className="size-4"/>} title="達成したこと">{ analysis.achieved }</Section> }
            { analysis.struggles && <Section icon={<Mountain className="size-4"/>} title="苦労したところ">{ analysis.struggles }</Section> }

            {
                analysis.nextActions.length > 0 && (
                    <Section icon={<Lightbulb className="size-4"/>} title="次のアクション">
                        <ul className="flex flex-col gap-1">
                            {
                                analysis.nextActions.map( ( action, i ) => (
                                    <li key={i} className="flex items-baseline gap-2">
                                        <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs">{ NEXT_ACTION_LABELS[ action.kind ] }</span>
                                        <span>{ action.detail }</span>
                                    </li>
                                ) )
                            }
                        </ul>
                    </Section>
                )
            }

            { analysis.evidenceSummary && <Section icon={<FileUp className="size-4"/>} title="証拠から分かったこと">{ analysis.evidenceSummary }</Section> }

            <div className="rounded-xl bg-muted px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
                <p className="mb-1 text-xs font-semibold text-muted-foreground">まとめ</p>
                { analysis.conclusion }
            </div>

            <p className="text-[11px] text-muted-foreground">
                { analysis.verification === "evidence"
                    ? `AI（${ analysis.model }）がアップロードされた証拠と振り返りをもとに推定した評価です。AIの見立てには誤りが含まれることがあります。`
                    : `AI（${ analysis.model }）が振り返りをもとに推定した評価です。自己申告のため、内容の正しさは確認していません。` }
            </p>

        </div>
    );

};

export default JourneyAnalysisView;
