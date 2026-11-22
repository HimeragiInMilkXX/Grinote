"use client";

import { signup } from "@/app/(auth)/actions"
import AuthForm from "./auth-form";
import { signupFormSchema } from "./schemas";

const SignupForm = () => (

    <AuthForm
        id="signup-form"
        schema={signupFormSchema}
        action={signup}
        title="アカウント作成"
        description="アカウントを作って、Grinote MVPを利用し始める"
        link={{ href: "/login", label: "すでにアカウントを持っている方" }}
        passwordHint={
            <ul className="text-sm text-muted-foreground list-disc ml-5">
                <li> 8〜20文字で入力してください </li>
                <li> 大文字と小文字をそれぞれ1文字以上含めてください </li>
                <li> 数字を1文字以上含めてください </li>
                <li> 記号を1文字以上含めてください </li>
            </ul>
        }
    />

)

export default SignupForm
