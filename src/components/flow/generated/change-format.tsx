"use client"

import type { TreeDiff } from "@/lib/tree/tree-changes";
import type { PreviewChangeKind, Task } from "@/types/flow";

export const FIELD_LABELS: Record<string, string> = {
    task_name: "名前",
    description: "説明",
    bg_color: "背景色",
    text_color: "文字色",
    isAction: "行動",
    time_limit: "時間",
    isLoop: "繰り返し",
    repetitions_required: "繰り返し回数",
};

export const KIND_STYLES: Record<PreviewChangeKind, { label: string, icon: string, className: string }> = {
    added: { label: "追加", icon: "＋", className: "bg-green-100 text-green-800 border-green-400" },
    updated: { label: "更新", icon: "✎", className: "bg-amber-100 text-amber-800 border-amber-400" },
    moved: { label: "移動", icon: "↪", className: "bg-blue-100 text-blue-800 border-blue-400" },
    deleted: { label: "削除", icon: "🗑", className: "bg-red-100 text-red-800 border-red-400" },
};

export const KindBadge = ( { kind, count }: { kind: PreviewChangeKind, count?: number } ) => (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium leading-none ${KIND_STYLES[kind].className}`}>
        {KIND_STYLES[kind].icon} {KIND_STYLES[kind].label}{ count !== undefined && ` ${count}` }
    </span>
);

export const formatFieldValue = ( key: string, value: unknown ): React.ReactNode => {

    if( value === undefined || value === null ) return "—";

    if( key === "time_limit" && typeof value === "object" ) {
        const t = value as Task["time_limit"];
        const parts = [ t.hours ? `${t.hours}時間` : "", t.minutes ? `${t.minutes}分` : "", t.seconds ? `${t.seconds}秒` : "" ].filter( Boolean );
        return parts.length ? parts.join( "" ) : "0分";
    }

    if( typeof value === "boolean" ) return value ? "はい" : "いいえ";

    if( ( key === "bg_color" || key === "text_color" ) && typeof value === "string" ) {
        return (
            <span className="inline-flex items-center gap-1">
                <span className="inline-block size-3 rounded-sm border border-gray-400" style={{ backgroundColor: value }}/>
                {value}
            </span>
        );
    }

    if( typeof value === "string" ) return value.trim() ? value : "（空）";

    return String( value );

};

/** before -> after table for updated fields */
export const FieldChangesTable = ( { before, after }: { before?: Partial<Task>, after?: Partial<Task> } ) => {

    if( !after ) return null;

    return (
        <table className="text-[11px] w-full border-collapse">
            <tbody>
                { Object.keys( after ).map( key => (
                    <tr key={key} className="align-top">
                        <td className="pr-2 font-medium whitespace-nowrap">{ FIELD_LABELS[key] ?? key }</td>
                        <td className="pr-1 text-gray-500 line-through break-all">{ formatFieldValue( key, ( before as Record<string, unknown> | undefined )?.[key] ) }</td>
                        <td className="px-1">→</td>
                        <td className="font-medium break-all">{ formatFieldValue( key, ( after as Record<string, unknown> )[key] ) }</td>
                    </tr>
                ) ) }
            </tbody>
        </table>
    );

};

export const diffCounts = ( diff: TreeDiff ) => ({
    added: diff.added.length,
    updated: diff.updated.length,
    moved: diff.moved.length,
    deleted: diff.deleted.length,
});

export const DiffCountBadges = ( { diff }: { diff: TreeDiff } ) => {
    const counts = diffCounts( diff );
    return (
        <span className="inline-flex flex-wrap gap-1">
            { ( Object.keys( counts ) as PreviewChangeKind[] ).filter( k => counts[k] > 0 ).map( k => <KindBadge key={k} kind={k} count={counts[k]}/> ) }
        </span>
    );
};

/** One line per change, with reasons */
export const ChangeList = ( { diff }: { diff: TreeDiff } ) => {

    const name = ( id: string | null ) => id ? ( diff.names[id] ?? id ) : "なし";

    return (
        <ul className="flex flex-col gap-1.5 text-xs">

            { diff.added.map( a => (
                <li key={`a-${a.id}`} className="flex flex-wrap items-center gap-1.5">
                    <KindBadge kind="added"/> <b>{a.task_name}</b> <span className="text-muted-foreground">← {name( a.parentId )} の下</span>
                </li>
            ) ) }

            { diff.updated.map( u => (
                <li key={`u-${u.id}`} className="flex flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-1.5"><KindBadge kind="updated"/> <b>{ diff.names[u.id] ?? u.task_name }</b> { u.reason && <span className="text-muted-foreground">（{u.reason}）</span> }</span>
                    <div className="pl-4"><FieldChangesTable before={u.before} after={u.after}/></div>
                </li>
            ) ) }

            { diff.moved.map( m => (
                <li key={`m-${m.id}`} className="flex flex-wrap items-center gap-1.5">
                    <KindBadge kind="moved"/> <b>{m.task_name}</b>
                    <span className="text-muted-foreground">{ name( m.fromParentId ) } → { name( m.toParentId ) }{ m.auto && "（親の削除による自動移動）" }</span>
                    { ( m.reason && !m.auto ) && <span className="text-muted-foreground">（{m.reason}）</span> }
                </li>
            ) ) }

            { diff.deleted.map( d => (
                <li key={`d-${d.id}`} className="flex flex-wrap items-center gap-1.5">
                    <KindBadge kind="deleted"/> <b className="line-through">{d.task_name}</b>
                    { d.reason && <span className="text-muted-foreground">（{d.reason}）</span> }
                </li>
            ) ) }

        </ul>
    );

};
