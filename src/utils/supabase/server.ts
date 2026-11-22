import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export async function createClient() {

    const cookieStore = await cookies();

    return createServerClient(

        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,

        {

            cookies: {

                getAll() {
                    return cookieStore.getAll().map( ( { name, value } ) => ( { name, value } ) )
                },

                setAll(_cookies) {},

            },

        }

    )

}
/**
 * Returns the signed-in user, or throws if there is none.
 * Use in server actions instead of querying with an undefined `user?.id`.
 */
export async function requireUser( supabase: SupabaseClient ): Promise<User> {

    const { data: { user } } = await supabase.auth.getUser();

    if( !user ) throw new Error( "Not logged in" );

    return user;

}
