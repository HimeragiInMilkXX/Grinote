/**
 * The three reflection questions of a task report and their validation.
 * Used as the report form's resolver and again in the server actions.
 */

import { z } from "zod";

export const REFLECTION_MIN_LENGTH = 5;
export const REFLECTION_MAX_LENGTH = 2000;
export const CLARIFICATION_ANSWER_MAX_LENGTH = 1000;

export type ReflectionKey = "learned" | "difficult" | "next";

export const REFLECTION_QUESTIONS: readonly { key: ReflectionKey; label: string; hint: string; placeholder: string }[] = [
    {
        key: "learned",
        label: "何ができた・学んだ・感じた？",
        hint: "大きな成果でなくても大丈夫。試したこと、気づいたこと、そのときの気持ちなど、体験したことを書いてください。",
        placeholder: "例：最初の3ページを読んで、用語の意味がだいぶ分かるようになった。",
    },
    {
        key: "difficult",
        label: "何が難しかった？",
        hint: "つまずいたところ、時間がかかったところ、迷ったところ。",
        placeholder: "例：図の読み方が分からず、何度も戻って読み直した。",
    },
    {
        key: "next",
        label: "次は何をすべきだと思う？",
        hint: "次の一歩、やり方の変更、準備したいもの。",
        placeholder: "例：図の読み方の解説動画を探してから、続きを読む。",
    },
];

const reflectionField = z.string()
    .transform( s => s.trim() )
    .pipe( z.string()
        .min( REFLECTION_MIN_LENGTH, `${REFLECTION_MIN_LENGTH}文字以上で書いてください` )
        .max( REFLECTION_MAX_LENGTH, `${REFLECTION_MAX_LENGTH}文字以内で書いてください` ) );

export const reflectionSchema = z.object( {
    learned: reflectionField,
    difficult: reflectionField,
    next: reflectionField,
} );

export type Reflection = z.infer<typeof reflectionSchema>;

export const EMPTY_REFLECTION: Reflection = { learned: "", difficult: "", next: "" };

/** Draft values (unvalidated, but trimmed to the DB limit). */
export function toReflectionDraft( value: Partial<Record<ReflectionKey, unknown>> | null | undefined ): Reflection {

    const pick = ( v: unknown ) => typeof v === "string" ? v.slice( 0, REFLECTION_MAX_LENGTH ) : "";

    return { learned: pick( value?.learned ), difficult: pick( value?.difficult ), next: pick( value?.next ) };

}

export type ReflectionValidation =
    | { ok: true; value: Reflection }
    | { ok: false; errors: Partial<Record<ReflectionKey, string>> };

export function validateReflection( value: unknown ): ReflectionValidation {

    const parsed = reflectionSchema.safeParse( value );

    if( parsed.success ) return { ok: true, value: parsed.data };

    const errors: Partial<Record<ReflectionKey, string>> = {};

    for( const issue of parsed.error.issues ) {
        const key = issue.path[0] as ReflectionKey | undefined;
        if( key && !errors[ key ] ) errors[ key ] = issue.message;
    }

    return { ok: false, errors };

}

/** Answers to the AI's clarifying questions: each must be non-empty unless the user skipped. */
export function validateClarificationAnswers( questions: readonly string[], answers: unknown ): { ok: true; value: string[] } | { ok: false; error: string } {

    if( !Array.isArray( answers ) || answers.length !== questions.length ) return { ok: false, error: "すべての質問に答えてください" };

    const value = answers.map( a => typeof a === "string" ? a.trim() : "" );

    if( value.some( a => a.length === 0 ) ) return { ok: false, error: "すべての質問に答えてください" };
    if( value.some( a => a.length > CLARIFICATION_ANSWER_MAX_LENGTH ) ) return { ok: false, error: `回答は${CLARIFICATION_ANSWER_MAX_LENGTH}文字以内で書いてください` };

    return { ok: true, value };

}
