"use server";

import { loginFormSchema } from "@/components/auth/login-form";
import { signupFormSchema } from "@/components/auth/signup-form";
import { createActionClient } from "@/utils/supabase/actions";
import { stringify } from "@/utils/utils";
import { redirect } from "next/navigation";
import { z } from "zod/v4";

export async function login( formData: z.infer<typeof loginFormSchema> ) {

    const supabase = await createActionClient();

    const email = stringify( formData.email );
    const password = stringify( formData.password );

    const { error } = await supabase.auth.signInWithPassword( { email, password } );

    if( error ) throw error;

    redirect("/")

}

export async function signup( formData: z.infer<typeof signupFormSchema> ) {

    const supabase = await createActionClient();

    const email = stringify( formData.email );
    const password = stringify( formData.password );

    const { error } = await supabase.auth.signUp( { email, password } );

    if( error ) throw error;

    redirect("/")

}

export async function logout() {

    const supabase = await createActionClient();

    await supabase.auth.signOut();

    redirect( "/login" );

}