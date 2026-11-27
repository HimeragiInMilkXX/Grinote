/** Japanese text for schedule DB errors (raised by the `schedule_items_guard` trigger). Client-safe. */

const MESSAGES: [ code: string, text: string ][] = [
    [ "schedule_done_locked", "完了済みの予定は変更・削除できません。" ],
    [ "schedule_past_day", "過去の日付には予定を追加・移動できません。" ],
    [ "schedule_over_limit", "このタスクはこれ以上予定できません（1回きりのタスクは1回、繰り返しタスクは残りの回数まで）。" ],
    [ "schedule_node_completed", "完了済みのタスクは予定できません。" ],
    [ "schedule_not_action", "このノードは予定できません（最終目標・レーベル）。" ],
    [ "schedule_foreign_node", "タスクが見つかりません。ツリーが変更された可能性があります。画面を更新してください。" ],
    [ "schedule_locked_field", "予定を更新できませんでした。" ],
    [ "schedule_items", "スケジュール機能のデータベースが準備されていません（マイグレーション未適用）。" ],
];

export const SCHEDULE_UNKNOWN_ERROR = "スケジュールを保存できませんでした。時間をおいて再試行してください。";

export function describeScheduleError( e: unknown ): string {

    const text = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String( ( e as { message: unknown } ).message ) : String( e );

    for( const [ code, message ] of MESSAGES ) {
        if( text.includes( code ) ) return message;
    }

    return SCHEDULE_UNKNOWN_ERROR;

}
