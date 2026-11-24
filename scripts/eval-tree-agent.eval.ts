/**
 * Tree-edit eval against local Ollama models.
 *
 *   npm run eval:tree                       # all models in src/lib/ai/models.ts
 *   EVAL_MODELS=gemma4:12b npm run eval:tree
 *
 * Uses the real system prompt, tool schemas and change engine; only Supabase is
 * replaced by a fixture graph. Model quality is reported, not asserted, so the
 * run never fails because a model answered badly.
 */
import { describe, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
import type { Task, TaskNodeType } from "@/types/flow";
import type { Edge } from "@xyflow/react";

const task = ( name: string, extra: Partial<Task> = {} ): Task => ({
    task_name: name, bg_color: "#FFFFFF", text_color: "#000000", description: "",
    isAction: true, time_limit: { hours: 0, minutes: 30, seconds: 0 }, isLoop: false,
    repetitions_required: 2, isCompleted: false, repetitions_completed: 0, isRoot: false, ...extra,
});

const ID = {
    root: "11111111-1111-4111-8111-111111111111",
    basics: "22222222-2222-4222-8222-222222222222",
    chords: "33333333-3333-4333-8333-333333333333",
    tuning: "44444444-4444-4444-8444-444444444444",
    song: "55555555-5555-4555-8555-555555555555",
    drill: "66666666-6666-4666-8666-666666666666",
    pick: "77777777-7777-4777-8777-777777777777",
    video: "88888888-8888-4888-8888-888888888888",
    videoChild: "99999999-9999-4999-8999-999999999999",
};

const fixtureNodes: [ string, Task, string | null ][] = [
    [ ID.root, task( "ギターで1曲弾けるようになる", { isRoot: true, isAction: false } ), null ],
    [ ID.basics, task( "基礎練習", { isAction: false } ), ID.root ],
    [ ID.chords, task( "コードを覚える" ), ID.basics ],
    [ ID.tuning, task( "チューニングを学ぶ", { isCompleted: true } ), ID.basics ],
    [ ID.song, task( "曲の練習", { isAction: false } ), ID.root ],
    [ ID.drill, task( "毎日の運指練習", { isLoop: true, repetitions_required: 10, repetitions_completed: 3, time_limit: { hours: 0, minutes: 15, seconds: 0 } } ), ID.song ],
    [ ID.pick, task( "好きな曲を選ぶ" ), ID.song ],
    [ ID.video, task( "ライブ動画を見る" ), ID.root ],
    [ ID.videoChild, task( "おすすめ動画を探す" ), ID.video ],
];

const fixture = () => ({
    nodes: fixtureNodes.map( ( [ id, t ] ): TaskNodeType => ({ id, position: { x: 0, y: 0 }, data: { label: t.task_name, task: t }, type: "taskNode" }) ),
    edges: fixtureNodes.filter( ( [ , , p ] ) => p ).map( ( [ id, , p ] ): Edge => ({ id: `${p}-${id}`, source: p!, target: id }) ),
});

vi.mock( "@/app/project/[projectId]/tree/serverActions", () => ({
    fetchGraph: vi.fn( async () => fixture() ),
    countRecordsForNodes: vi.fn( async () => ({}) ),
}) );

vi.mock( "@/lib/projects", () => ({
    getProject: vi.fn( async () => ({
        id: "eval-project", name: "ギター", final_goal: "ギターで1曲弾けるようになる", description: "初心者。週に数回練習したい。",
        achieve_date_goal: "2027-03-01", character_name_changed_at: null, daily_time_goal: "00:30:00", work_days: [ 1, 3, 5, 6 ], streak: 4,
    }) ),
}) );

type Kind ="add" | "update" | "move" | "delete";

type Scenario = {
    name: string;
    prompt: string;
    /** Returns null when passed, else why it failed. */
    check: ( r: RunResult ) => string | null;
};

type Proposal = { ops: Record<Kind, { id?: string, key?: string, parentKey?: string, newParent?: string, changes?: Record<string, unknown> }[]>, protectedNodes: { id: string }[] };

type RunResult = {
    proposals: Proposal[];
    toolErrors: string[];
    askedUser: boolean;
    text: string;
};

const has = ( p: Proposal | undefined, kind: Kind, pred: ( op: any ) => boolean = () => true ) => !!p?.ops[kind].some( pred );
const last = ( r: RunResult ) => r.proposals.at( -1 );

const scenarios: Scenario[] = [
    {
        name: "update: rename + time",
        prompt: "「コードを覚える」の名前を「基本コード（C・G・Am・F）を覚える」に変えて、時間を45分にしてください。",
        check: r => has( last( r ), "update", op => op.id === ID.chords && typeof op.changes?.task_name === "string" && ( op.changes?.time_limit as any )?.minutes === 45 ) ? null : "no update of コードを覚える with name + 45min",
    },
    {
        name: "delete: unnecessary branch",
        prompt: "「ライブ動画を見る」は不要なので、その子タスクも含めて削除してください。",
        check: r => has( last( r ), "delete", op => op.id === ID.video ) ? null : "ライブ動画を見る not deleted",
    },
    {
        name: "move: reconnect",
        prompt: "「好きな曲を選ぶ」を「基礎練習」の下に移動してください。",
        check: r => has( last( r ), "move", op => op.id === ID.pick && op.newParent === ID.basics ) ? null : "no move of 好きな曲を選ぶ under 基礎練習",
    },
    {
        name: "add: breakdown",
        prompt: "「曲の練習」の下に、具体的な練習アクションを3つ追加してください。",
        check: r => {
            const p = last( r );
            const adds = p?.ops.add ?? [];
            return adds.length >= 2 && adds.some( a => a.parentKey === ID.song ) ? null : `expected adds under 曲の練習, got ${adds.length}`;
        },
    },
    {
        name: "guard: root edit refused",
        prompt: "ルートのゴール名を「ギターで3曲弾けるようになる」に変更してください。",
        check: r => r.proposals.some( p => has( p, "update", op => op.id === ID.root ) ) ? "root was changed" : null,
    },
    {
        name: "guard: completed delete refused",
        prompt: "「チューニングを学ぶ」を削除してください。",
        check: r => r.proposals.some( p => has( p, "delete", op => op.id === ID.tuning ) ) ? "completed node deleted" : null,
    },
    {
        name: "guard: progressed loop asks",
        prompt: "「毎日の運指練習」の回数を20回に増やしてください。",
        check: r => {
            if( r.askedUser ) return null;
            const p = last( r );
            return p && p.protectedNodes.some( n => n.id === ID.drill ) ? null : "neither asked nor flagged the loop";
        },
    },
    {
        name: "mixed: delete + move + add",
        prompt: "「ライブ動画を見る」を子タスクごと削除し、「好きな曲を選ぶ」を「基礎練習」の下に移動し、「基礎練習」に「リズム練習」というアクションを追加してください。",
        check: r => {
            const p = last( r );
            const missing = [
                !has( p, "delete", op => op.id === ID.video ) && "delete",
                !has( p, "move", op => op.id === ID.pick ) && "move",
                !has( p, "add", op => op.parentKey === ID.basics ) && "add",
            ].filter( Boolean );
            return missing.length ? `missing: ${missing.join( ", " )}` : null;
        },
    },
];

async function runScenario( modelId: string, prompt: string ): Promise<RunResult> {

    const { generateText, isStepCount } = await import( "ai" );
    const { getChatModel } = await import( "@/lib/ai/provider" );
    const { generateSystemPrompt } = await import( "@/lib/ai/system-prompt" );
    const { getTools } = await import( "@/tools" );

    const tools = getTools( modelId );
    // Keep the eval offline and deterministic
    const { web_search: _w, github_repo: _g, ...evalTools } = tools;

    const result = await generateText({
        model: getChatModel( modelId ),
        system: generateSystemPrompt( "eval-project" ),
        prompt,
        tools: evalTools,
        stopWhen: isStepCount( 5 ),
        maxOutputTokens: 8192,
    });

    const parts = result.steps.flatMap( s => s.content ) as any[];

    return {
        proposals: parts.filter( p => p.type === "tool-result" && p.toolName === "propose_goal_tree" ).map( p => p.output ),
        toolErrors: parts.filter( p => p.type === "tool-error" ).map( p => `${p.toolName}: ${String( p.error?.message ?? p.error ).slice( 0, 300 )}` ),
        askedUser: parts.some( p => p.type === "tool-call" && p.toolName === "ask_user" ),
        text: result.text,
    };
}

const { MODELS } = await import( "@/lib/ai/models" );
const models = process.env.EVAL_MODELS ? process.env.EVAL_MODELS.split( "," ) : MODELS.map( m => m.id );

const report: Record<string, unknown>[] = [];

describe.sequential( "tree-edit agent eval", () => {

    for( const modelId of models ) {

        it( modelId, async () => {

            for( const s of scenarios ) {
                const start = Date.now();
                let row: Record<string, unknown>;
                try {
                    const r = await runScenario( modelId, s.prompt );
                    const failure = s.check( r );
                    row = { model: modelId, scenario: s.name, pass: !failure, why: failure ?? "", proposals: r.proposals.length, toolErrors: r.toolErrors.length, askedUser: r.askedUser, seconds: Math.round( ( Date.now() - start ) / 1000 ), errors: r.toolErrors, reply: r.text.slice( 0, 300 ) };
                } catch( e ) {
                    row = { model: modelId, scenario: s.name, pass: false, why: `request failed: ${( e as Error ).message.slice( 0, 200 )}`, proposals: 0, toolErrors: 0, askedUser: false, seconds: Math.round( ( Date.now() - start ) / 1000 ) };
                }
                report.push( row );
                console.log( `[${modelId}] ${row.pass ? "PASS" : "FAIL"} ${s.name} (${row.seconds}s) ${row.why}` );
            }

            const mine = report.filter( r => r.model === modelId );
            console.log( `[${modelId}] ${mine.filter( r => r.pass ).length}/${mine.length} passed` );

        });

    }

    it( "report", () => {
        console.table( report.map( ( { model, scenario, pass, proposals, toolErrors, askedUser, seconds } ) => ({ model, scenario, pass, proposals, toolErrors, askedUser, seconds }) ) );
        const out = process.env.EVAL_OUT;
        if( out ) writeFileSync( out, JSON.stringify( report, null, 2 ) );
    });

});
