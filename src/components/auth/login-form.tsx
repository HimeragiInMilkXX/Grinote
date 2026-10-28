"use client";

import { login } from "@/app/(auth)/actions"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod/v4"
import { Field, FieldError, FieldGroup, FieldLabel } from "../ui/field"
import { Input } from "../ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card"
import { Button } from "../ui/button"
import Link from "next/link";

export const loginFormSchema = z.object({

    email: z.email( "有効なメールアドレスを入力してください。" ),
    password: z.string()

})

const LoginForm = () => {

    const form = useForm<z.infer<typeof loginFormSchema>>( {

        resolver: zodResolver( loginFormSchema ),
        defaultValues: {

            email: "",
            password: ""

        }

    } )

    const { isSubmitting } = form.formState;

    async function onSubmit( data: z.infer<typeof loginFormSchema> ) {

        await login( data );

    }

    return (

        <Card className="w-full sm:max-w-md">

            <CardHeader>
                <CardTitle> ログイン </CardTitle>
                <CardDescription> Grinote MVPを利用するには、アカウントが必要です </CardDescription>
                <Link href="/signup" className="text-blue-500 underline text-xs"> アカウントを持っていない方 </Link>
            </CardHeader>

            <CardContent>
                <form id="login-form" onSubmit={form.handleSubmit(onSubmit)}>
                    <FieldGroup>
                        <Controller
                            name="email"
                            control={form.control}
                            render={ ( { field, fieldState } ) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="login-form-email"> メールアドレス </FieldLabel>
                                    <Input { ...field } id="login-form-email" type="email" aria-invalid={fieldState.invalid} placeholder="user@example.com" autoComplete="off" />
                                    { fieldState.invalid && (
                                        <FieldError errors={[fieldState.error]} />
                                    )}
                                </Field>
                            )}
                        />
                        <Controller
                            name="password"
                            control={form.control}
                            render={ ( { field, fieldState } ) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="login-form-password"> パスワード </FieldLabel>
                                    <Input { ...field } id="login-form-password" type="password" aria-invalid={fieldState.invalid} placeholder="●●●●●●●●" autoComplete="off" />
                                    { fieldState.invalid && (
                                        <FieldError errors={[fieldState.error]} />
                                    )}
                                </Field>
                            )}
                        />
                    </FieldGroup>
                </form>
            </CardContent>

            <CardFooter>
                <Button type="submit" form="login-form" className="w-full" disabled={isSubmitting}> { isSubmitting ? "送信中..." : "次へ" } </Button>
            </CardFooter>

        </Card>

    )
}

export default LoginForm
