"use client";

import { login } from "@/app/(auth)/actions"
import AuthForm from "./auth-form";
import { loginFormSchema } from "./schemas";

const LoginForm = () => (

    <AuthForm
        id="login-form"
        schema={loginFormSchema}
        action={login}
        title="ログイン"
        description="Grinote MVPを利用するには、アカウントが必要です"
        link={{ href: "/signup", label: "アカウントを持っていない方" }}
    />

)

export default LoginForm
