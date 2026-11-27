/**
 * Project colors (calendar blocks, project cards, pickers).
 * The keys are stored in `projects.color`; the DB CHECK constraint `projects_color_check`
 * (supabase/migrations/20261127000001_project_color.sql) lists the same keys, so keep both in sync.
 * Tailwind v4 only generates classes it can see, so every class here is a literal string.
 */

export const PROJECT_COLOR_KEYS = [ "teal", "amber", "violet", "blue", "rose", "green", "orange", "cyan", "pink", "slate" ] as const;

export type ProjectColor = typeof PROJECT_COLOR_KEYS[number];

export type ProjectColorStyle = {
    key: ProjectColor;
    /** Japanese label for pickers / screen readers */
    label: string;
    /** filled block: background + readable text + hover */
    solid: string;
    /** outlined / tinted block (e.g. work outside the plan) */
    soft: string;
    /** small swatch / legend dot */
    dot: string;
    /** left accent border on cards */
    accent: string;
};

export const PROJECT_COLORS: readonly ProjectColorStyle[] = [
    { key: "teal",   label: "ティール",   solid: "bg-teal-700 text-white hover:bg-teal-800",     soft: "border-teal-600 bg-teal-50 text-teal-900 hover:bg-teal-100 dark:bg-teal-950 dark:text-teal-100",         dot: "bg-teal-700",   accent: "border-l-teal-700" },
    { key: "amber",  label: "アンバー",   solid: "bg-amber-700 text-white hover:bg-amber-800",   soft: "border-amber-600 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-100",   dot: "bg-amber-700",  accent: "border-l-amber-700" },
    { key: "violet", label: "バイオレット", solid: "bg-violet-600 text-white hover:bg-violet-700", soft: "border-violet-500 bg-violet-50 text-violet-900 hover:bg-violet-100 dark:bg-violet-950 dark:text-violet-100", dot: "bg-violet-600", accent: "border-l-violet-600" },
    { key: "blue",   label: "ブルー",     solid: "bg-blue-600 text-white hover:bg-blue-700",     soft: "border-blue-500 bg-blue-50 text-blue-900 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-100",         dot: "bg-blue-600",   accent: "border-l-blue-600" },
    { key: "rose",   label: "ローズ",     solid: "bg-rose-600 text-white hover:bg-rose-700",     soft: "border-rose-500 bg-rose-50 text-rose-900 hover:bg-rose-100 dark:bg-rose-950 dark:text-rose-100",         dot: "bg-rose-600",   accent: "border-l-rose-600" },
    { key: "green",  label: "グリーン",   solid: "bg-green-700 text-white hover:bg-green-800",   soft: "border-green-600 bg-green-50 text-green-900 hover:bg-green-100 dark:bg-green-950 dark:text-green-100",   dot: "bg-green-700",  accent: "border-l-green-700" },
    { key: "orange", label: "オレンジ",   solid: "bg-orange-700 text-white hover:bg-orange-800", soft: "border-orange-600 bg-orange-50 text-orange-900 hover:bg-orange-100 dark:bg-orange-950 dark:text-orange-100", dot: "bg-orange-700", accent: "border-l-orange-700" },
    { key: "cyan",   label: "シアン",     solid: "bg-cyan-700 text-white hover:bg-cyan-800",     soft: "border-cyan-600 bg-cyan-50 text-cyan-900 hover:bg-cyan-100 dark:bg-cyan-950 dark:text-cyan-100",         dot: "bg-cyan-700",   accent: "border-l-cyan-700" },
    // "pink" uses Tailwind's fuchsia shades: pink-600 is too close to rose-600 next to each other
    { key: "pink",   label: "ピンク",     solid: "bg-fuchsia-600 text-white hover:bg-fuchsia-700", soft: "border-fuchsia-500 bg-fuchsia-50 text-fuchsia-900 hover:bg-fuchsia-100 dark:bg-fuchsia-950 dark:text-fuchsia-100", dot: "bg-fuchsia-600", accent: "border-l-fuchsia-600" },
    { key: "slate",  label: "スレート",   solid: "bg-slate-600 text-white hover:bg-slate-700",   soft: "border-slate-500 bg-slate-50 text-slate-900 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-100",   dot: "bg-slate-600",  accent: "border-l-slate-600" },
];

const BY_KEY = new Map<string, ProjectColorStyle>( PROJECT_COLORS.map( c => [ c.key, c ] ) );

export function isProjectColor( value: unknown ): value is ProjectColor {

    return typeof value === "string" && BY_KEY.has( value );

}

/** Styles for a stored color; unknown values (bad data) fall back to the first color. */
export function projectColorStyle( key: string | null | undefined ): ProjectColorStyle {

    return ( key ? BY_KEY.get( key ) : undefined ) ?? PROJECT_COLORS[0];

}

/** First color not used by the user's other projects; once all are used, cycles by count. */
export function pickDefaultColor( used: readonly ( string | null | undefined )[] ): ProjectColor {

    const taken = new Set( used );
    const free = PROJECT_COLOR_KEYS.find( key => !taken.has( key ) );

    return free ?? PROJECT_COLOR_KEYS[ used.length % PROJECT_COLOR_KEYS.length ];

}
