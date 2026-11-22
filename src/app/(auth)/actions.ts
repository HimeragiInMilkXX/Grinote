"use server";

import { AuthActionResult, AuthFormValues, loginFormSchema, signupFormSchema } from "@/components/auth/schemas";
import { createActionClient } from "@/utils/supabase/actions";
import { redirect } from "next/navigation";

export async function login( formData: AuthFormValues ): Promise<AuthActionResult | void> {

    const parsed = loginFormSchema.safeParse( formData );
    if( !parsed.success ) return { error: "入力内容を確認してください。" };

    const supabase = await createActionClient();

    const { error } = await supabase.auth.signInWithPassword( parsed.data );

    if( error ) return { error: "メールアドレスまたはパスワードが正しくありません。" };

    redirect("/")

}

export async function signup( formData: AuthFormValues ): Promise<AuthActionResult | void> {

    const parsed = signupFormSchema.safeParse( formData );
    if( !parsed.success ) return { error: "入力内容を確認してください。" };

    const supabase = await createActionClient();

    const { error } = await supabase.auth.signUp( parsed.data );

    if( error ) return { error: "アカウントを作成できませんでした。" + error.message };

    redirect("/")

}

export async function logout() {

    const supabase = await createActionClient();

    await supabase.auth.signOut();

    redirect( "/login" );

}
