/**
 * Shape of the AI's task report analysis and its normalization.
 * The model only fills the fields below; the score total, the verification status and every
 * limit are decided here in code (unit-tested), never taken from the model.
 */

import { z } from "zod";
import type { Reflection } from "./reflection";

export const RUBRIC = {
    relevance: { max: 30, label: "タスクとの関連性" },
    attempt: { max: 40, label: "挑戦・努力" },
    seriousness: { max: 30, label: "真剣さ" },
} as const;

export type RubricKey = keyof typeof RUBRIC;

export const RUBRIC_KEYS = Object.keys( RUBRIC ) as RubricKey[];

export const NEXT_ACTION_KINDS = [ "update_tree", "break_down", "prepare_materials", "continue", "review" ] as const;

export type NextActionKind = typeof NEXT_ACTION_KINDS[ number ];

export const NEXT_ACTION_LABELS: Record<NextActionKind, string> = {
    update_tree: "目標ツリーを更新",
    break_down: "タスクを細かく分ける",
    prepare_materials: "マテリアルを準備",
    continue: "このまま続ける",
    review: "振り返り・復習",
};

export const MAX_CLARIFYING_QUESTIONS = 2;
export const MAX_NEXT_ACTIONS = 3;
const TEXT_LIMIT = 1200;
const QUESTION_LIMIT = 300;

/**
 * What the model returns. Deliberately flat and loose (small local models): ranges and
 * enum values are enforced by normalizeAnalysis, not by the schema.
 */
export const modelAnalysisSchema = z.object( {
    decision: z.enum( [ "analyze", "clarify" ] ).describe( "\"clarify\" only when the report is too vague to judge; otherwise \"analyze\"." ),
    clarifying_questions: z.array( z.string() ).describe( "1-2 short questions in Japanese when decision is \"clarify\", else []." ),
    did: z.string().describe( "Japanese. What the user did, learned or tried in this session." ),
    achieved: z.string().describe( "Japanese. What the user achieved (can be small, or nothing yet)." ),
    struggles: z.string().describe( "Japanese. Which parts the user struggled with." ),
    next_actions: z.array( z.object( {
        kind: z.string().describe( `One of: ${NEXT_ACTION_KINDS.join( ", " )}.` ),
        detail: z.string().describe( "Japanese. One concrete suggestion." ),
    } ) ).describe( "1-3 suggested next actions." ),
    conclusion: z.string().describe( "Japanese. 2-3 sentences: the overall conclusion of this session, warm and honest." ),
    relevance: z.number().describe( "0-30. Did the user do things really relevant to the task?" ),
    relevance_reason: z.string().describe( "Japanese. One sentence." ),
    attempt: z.number().describe( "0-40. Did the user genuinely try, even if the task was too hard?" ),
    attempt_reason: z.string().describe( "Japanese. One sentence." ),
    seriousness: z.number().describe( "0-30. Did the user take the task seriously, or only report for the streak?" ),
    seriousness_reason: z.string().describe( "Japanese. One sentence." ),
} );

export type ModelAnalysis = z.infer<typeof modelAnalysisSchema>;

export type Verification = "self_report" | "evidence";

export interface RubricItem { score: number; max: number; reason: string }

/** Stored in `task_journals.analysis`. */
export interface JourneyAnalysis {
    version: 1;
    did: string;
    achieved: string;
    struggles: string;
    nextActions: { kind: NextActionKind; detail: string }[];
    conclusion: string;
    verification: Verification;
    rubric: Record<RubricKey, RubricItem>;
    /** Sum of the rubric parts, 0..100. */
    score: number;
    /** The model had to judge without asking (no rounds left or the user skipped). */
    forcedFinal: boolean;
    model: string;
    analyzedAt: string;
    /** The reflections this analysis was made from (written back on confirm). */
    reflection?: Reflection;
}

export type NormalizedAnalysis =
    | { kind: "clarify"; questions: string[] }
    | { kind: "analysis"; analysis: JourneyAnalysis }
    | { kind: "invalid"; reason: string };

const clean = ( v: unknown, limit = TEXT_LIMIT ) => typeof v === "string" ? v.trim().slice( 0, limit ) : "";

export function clampRubric( value: unknown, max: number ): number {

    const n = typeof value === "number" ? value : typeof value === "string" ? Number( value ) : NaN;
    if( !Number.isFinite( n ) ) return 0;

    return Math.min( max, Math.max( 0, Math.round( n ) ) );

}

function toKind( value: unknown ): NextActionKind {

    const v = typeof value === "string" ? value.trim().toLowerCase() : "";
    return ( NEXT_ACTION_KINDS as readonly string[] ).includes( v ) ? v as NextActionKind : "continue";

}

/**
 * Turn raw model output into either clarifying questions or a stored analysis.
 * `canClarify` is false when no clarification rounds are left or the user skipped.
 */
export function normalizeAnalysis( raw: unknown, opts: { canClarify: boolean; hasEvidence: boolean; model: string; now?: Date } ): NormalizedAnalysis {

    if( !raw || typeof raw !== "object" ) return { kind: "invalid", reason: "not an object" };

    const r = raw as Partial<Record<keyof ModelAnalysis, unknown>>;

    const questions = Array.isArray( r.clarifying_questions )
        ? r.clarifying_questions.map( q => clean( q, QUESTION_LIMIT ) ).filter( Boolean ).slice( 0, MAX_CLARIFYING_QUESTIONS )
        : [];

    const did = clean( r.did );
    const conclusion = clean( r.conclusion );

    if( r.decision === "clarify" && opts.canClarify && questions.length > 0 ) return { kind: "clarify", questions };

    // a "clarify" without questions or rounds only counts if the analysis itself is filled in
    if( !did || !conclusion ) return { kind: "invalid", reason: r.decision === "clarify" ? "asked to clarify when it had to judge" : "missing did/conclusion" };

    const nextActions = Array.isArray( r.next_actions )
        ? r.next_actions
            .map( a => a && typeof a === "object" ? { kind: toKind( ( a as { kind?: unknown } ).kind ), detail: clean( ( a as { detail?: unknown } ).detail, 400 ) } : null )
            .filter( ( a ): a is { kind: NextActionKind; detail: string } => !!a && !!a.detail )
            .slice( 0, MAX_NEXT_ACTIONS )
        : [];

    const rubric = {
        relevance: { score: clampRubric( r.relevance, RUBRIC.relevance.max ), max: RUBRIC.relevance.max, reason: clean( r.relevance_reason, 400 ) },
        attempt: { score: clampRubric( r.attempt, RUBRIC.attempt.max ), max: RUBRIC.attempt.max, reason: clean( r.attempt_reason, 400 ) },
        seriousness: { score: clampRubric( r.seriousness, RUBRIC.seriousness.max ), max: RUBRIC.seriousness.max, reason: clean( r.seriousness_reason, 400 ) },
    };

    const score = rubric.relevance.score + rubric.attempt.score + rubric.seriousness.score;

    return {
        kind: "analysis",
        analysis: {
            version: 1,
            did,
            achieved: clean( r.achieved ),
            struggles: clean( r.struggles ),
            nextActions,
            conclusion,
            verification: opts.hasEvidence ? "evidence" : "self_report",
            rubric,
            score,
            forcedFinal: !opts.canClarify,
            model: opts.model,
            analyzedAt: ( opts.now ?? new Date() ).toISOString(),
        },
    };

}

/** Narrow the stored jsonb back to an analysis (null for drafts or unknown shapes). */
export function asJourneyAnalysis( value: unknown ): JourneyAnalysis | null {

    if( !value || typeof value !== "object" ) return null;

    const v = value as Partial<JourneyAnalysis>;

    return v.version === 1 && typeof v.score === "number" && typeof v.conclusion === "string" && !!v.rubric ? v as JourneyAnalysis : null;

}

/**
 * Best-effort JSON extraction for models that wrap the object in prose or code fences.
 * Returns undefined when nothing parses.
 */
export function parseLooseJson( text: string | undefined | null ): unknown {

    if( !text ) return undefined;

    const stripped = text.replace( /<think>[\s\S]*?<\/think>/g, "" ).replace( /```(?:json)?/gi, "" ).trim();

    try { return JSON.parse( stripped ); } catch { /* fall through */ }

    const start = stripped.indexOf( "{" );
    const end = stripped.lastIndexOf( "}" );

    if( start >= 0 && end > start ) {
        try { return JSON.parse( stripped.slice( start, end + 1 ) ); } catch { /* fall through */ }
    }

    return undefined;

}
