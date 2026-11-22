import { z } from "zod/v4";

export const loginFormSchema = z.object({

    email: z.email( "有効なメールアドレスを入力してください。" ),
    password: z.string()

})

export const signupFormSchema = z.object({

    email: z.email( "有効なメールアドレスを入力してください。" ),
    password: z.string()
        .min(8, "パスワードは8文字以上で入力してください")
        .max(20, "パスワードは20文字以下で入力してください")
        .regex(/[A-Z]/, "大文字を1文字以上含めてください")
        .regex(/[a-z]/, "小文字を1文字以上含めてください")
        .regex(/[0-9]/, "数字を1文字以上含めてください")
        .regex(/[@$!%*?&#^()_+\-=\[\]{};':"\|,.<>\/?]/, "記号を1文字以上含めてください")

})

export type AuthFormValues = z.infer<typeof loginFormSchema>;

/** Result returned by the auth server actions when they don't redirect. */
export type AuthActionResult = { error: string };
