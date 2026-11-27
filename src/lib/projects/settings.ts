import { z } from "zod/v4";
import { format } from "date-fns";
import type { DurationObject } from "@/types/global";
import { durationObjectToInterval, intervalToDurationObject, intervalToSeconds } from "@/utils/utils";
import { normalizeWorkDays, sameWorkDays, type Weekday } from "./work-days";
import { isProjectColor, PROJECT_COLOR_KEYS, PROJECT_COLORS, type ProjectColor } from "./colors";

/**
 * Editable project settings. `final_goal`, `character_id` and the character's
 * level/XP are never editable; `character_given_name` can be changed once
 * (`projects.character_name_changed_at`). The DB trigger `projects_guard_settings`
 * enforces the same rules, this module is the app-side check.
 */

export const CHARACTER_NAME_MAX = 20;
export const PROJECT_NAME_MAX = 60;
export const DAILY_GOAL_MIN_SECONDS = 120;
export const DAILY_GOAL_MAX_HOURS = 10;

export type ProjectSettingsInput = {
    name: string;
    description: string;
    /** yyyy-MM-dd */
    achieve_date_goal: string;
    daily_time_goal: DurationObject;
    work_days: number[];
    character_given_name: string;
    color: ProjectColor;
};

/** The columns this feature reads from a `projects` row. */
export type ProjectSettingsSource = {
    name: string | null;
    description: string | null;
    achieve_date_goal: string | null;
    daily_time_goal: string | null;
    work_days: number[] | null;
    character_given_name: string | null;
    character_name_changed_at: string | null;
    color: string | null;
};

export type ProjectSettingsPatch = Partial<{
    name: string;
    description: string;
    achieve_date_goal: string;
    daily_time_goal: string;
    work_days: Weekday[];
    character_given_name: string;
    color: ProjectColor;
}>;

export type SettingsField = keyof ProjectSettingsInput;

export type BuildPatchResult =
    | { ok: true; patch: ProjectSettingsPatch }
    | { ok: false; errors: Partial<Record<SettingsField, string>> };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateString( value: string ) {

    if( !DATE_RE.test( value ) ) return false;
    const d = new Date( `${value}T00:00:00` );
    return !Number.isNaN( d.getTime() ) && format( d, "yyyy-MM-dd" ) === value;

}

const durationSchema = z.object({
    hours: z.number().int().min( 0 ).max( DAILY_GOAL_MAX_HOURS ),
    minutes: z.number().int().min( 0 ).max( 59 ),
    seconds: z.number().int().min( 0 ).max( 59 ),
}).refine(
    val => intervalToSeconds( val ) >= DAILY_GOAL_MIN_SECONDS && intervalToSeconds( val ) <= DAILY_GOAL_MAX_HOURS * 3600,
    { message: `2分以上、${DAILY_GOAL_MAX_HOURS}時間以内で設定してください` },
);

/** Shape/format rules that don't depend on the saved row. */
export const projectSettingsSchema = z.object({
    name: z.string().trim().min( 1, "プロジェクト名を入力してください" ).max( PROJECT_NAME_MAX, `${PROJECT_NAME_MAX}文字以内で入力してください` ),
    description: z.string().max( 2000, "2000文字以内で入力してください" ),
    achieve_date_goal: z.string().refine( isValidDateString, "有効な日付を選んでください" ),
    daily_time_goal: durationSchema,
    work_days: z.array( z.number() ).refine( days => normalizeWorkDays( days ).length > 0, "少なくとも1つの曜日を選んでください" ),
    character_given_name: z.string().trim().min( 1, "キャラクターネームを入力してください" ).max( CHARACTER_NAME_MAX, `${CHARACTER_NAME_MAX}文字以内で入力してください` ),
    color: z.enum( PROJECT_COLOR_KEYS, { message: "カラーを選んでください" } ),
});

export function todayString( now: Date = new Date() ) {

    return format( now, "yyyy-MM-dd" );

}

/** Form values for a saved project row. */
export function projectToSettingsInput( project: ProjectSettingsSource ): ProjectSettingsInput {

    return {
        name: project.name ?? "",
        description: project.description ?? "",
        achieve_date_goal: ( project.achieve_date_goal ?? "" ).slice( 0, 10 ),
        daily_time_goal: project.daily_time_goal ? intervalToDurationObject( project.daily_time_goal ) : { hours: 0, minutes: 0, seconds: 0 },
        work_days: normalizeWorkDays( project.work_days ),
        character_given_name: project.character_given_name ?? "",
        color: isProjectColor( project.color ) ? project.color : PROJECT_COLORS[0].key,
    };

}

export function canRenameCharacter( project: Pick<ProjectSettingsSource, "character_name_changed_at"> ) {

    return project.character_name_changed_at == null;

}

/**
 * Validates `input` against the saved row and returns only the columns that changed.
 * Rules that depend on the saved row:
 *  - the target date must be today or later, but only when it is changed
 *  - the character name can only change while `character_name_changed_at` is null
 */
export function buildSettingsPatch( current: ProjectSettingsSource, input: unknown, now: Date = new Date() ): BuildPatchResult {

    const parsed = projectSettingsSchema.safeParse( input );
    const saved = projectToSettingsInput( current );
    const errors: Partial<Record<SettingsField, string>> = {};

    if( !parsed.success ) {

        for( const issue of parsed.error.issues ) {

            const field = issue.path[0] as SettingsField | undefined;
            if( field && !errors[field] ) errors[field] = issue.message;

        }

    }

    // Rules against the saved row run even when other fields are invalid, so every error shows at once.
    const raw = ( input ?? {} ) as Partial<Record<SettingsField, unknown>>;

    if( !errors.achieve_date_goal && typeof raw.achieve_date_goal === "string"
        && raw.achieve_date_goal !== saved.achieve_date_goal && raw.achieve_date_goal < todayString( now ) )
        errors.achieve_date_goal = "達成日は今日以降の日付を選んでください";

    if( !errors.character_given_name && typeof raw.character_given_name === "string"
        && raw.character_given_name.trim() !== saved.character_given_name && !canRenameCharacter( current ) )
        errors.character_given_name = "キャラクターネームはすでに変更済みです";

    if( !parsed.success || Object.keys( errors ).length > 0 ) return { ok: false, errors };

    const next = parsed.data;
    const patch: ProjectSettingsPatch = {};

    if( next.name !== saved.name ) patch.name = next.name;

    const description = next.description.trim();
    if( description !== saved.description.trim() ) patch.description = description;

    if( next.achieve_date_goal !== saved.achieve_date_goal ) patch.achieve_date_goal = next.achieve_date_goal;

    if( !current.daily_time_goal || intervalToSeconds( next.daily_time_goal ) !== intervalToSeconds( saved.daily_time_goal ) ) {

        patch.daily_time_goal = durationObjectToInterval( next.daily_time_goal );

    }

    if( !sameWorkDays( next.work_days, current.work_days ) ) patch.work_days = normalizeWorkDays( next.work_days );

    if( next.character_given_name !== saved.character_given_name ) patch.character_given_name = next.character_given_name;

    if( next.color !== current.color ) patch.color = next.color;

    return { ok: true, patch };

}

const DB_ERROR_MESSAGES: Record<string, string> = {
    project_active_task: "タスク実行中（レポート未提出を含む）は設定を変更できません。タスクを完了してレポートを確定するか、中止してから変更してください。",
    project_character_name_locked: "キャラクターネームはすでに変更済みです。",
    project_locked_field: "この項目は変更できません。",
    project_not_found: "プロジェクトが見つかりません。",
};

/** Maps the guard trigger / RPC error keys to Japanese text. */
export function describeProjectSettingsError( message: string | null | undefined ): string {

    const text = message ?? "";

    for( const [ key, value ] of Object.entries( DB_ERROR_MESSAGES ) ) {

        if( text.includes( key ) ) return value;

    }

    return text || "設定の保存に失敗しました。";

}
