"use client";

import { signup } from "@/app/(auth)/actions"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod/v4"
import { Field, FieldError, FieldGroup, FieldLabel } from "../ui/field"
import { Input } from "../ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card"
import { Button } from "../ui/button"
import Link from "next/link";

export const signupFormSchema = z.object({

    email: z.email( "有効なメールアドレスを入力してください。" ),
    password: z.string()
        .min(8, "パスワードは8文字以上で入力してください")
        .max(20, "パスワードは20文字以下で入力してください")
        .regex(/[A-Z]/, "大文字を1文字以上含めてください")
        .regex(/[a-z]/, "小文字を1文字以上含めてください")
        .regex(/[0-9]/, "数字を1文字以上含めてください")
        .regex(/[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/?]/, "記号を1文字以上含めてください")

})

const SignupForm = () => {

    const form = useForm<z.infer<typeof signupFormSchema>>( {

        resolver: zodResolver( signupFormSchema ),
        defaultValues: {

            email: "",
            password: ""

        }

    } )

    async function onSubmit( data: z.infer<typeof signupFormSchema> ) {

        try {

            await signup( data );

        } catch( e: any ) {

            console.log( e.message );

        }

    }

    const { isSubmitting } = form.formState

    return (

        <Card className="w-full sm:max-w-md">

            <CardHeader>
                <CardTitle> アカウント作成 </CardTitle>
                <CardDescription> アカウントを作って、Grinote MVPを利用し始める </CardDescription>
                <Link href="/login" className="text-blue-500 underline text-xs"> すでにアカウントを持っている方 </Link>
            </CardHeader>

            <CardContent>
                <form id="signup-form" onSubmit={form.handleSubmit(onSubmit)}>
                    <FieldGroup>
                        <Controller
                            name="email"
                            control={form.control}
                            render={ ( { field, fieldState } ) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="signup-form-email"> メールアドレス </FieldLabel>
                                    <Input { ...field } id="signup-form-email" type="email" aria-invalid={fieldState.invalid} placeholder="user@example.com" autoComplete="off" />
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
                                    <FieldLabel htmlFor="signup-form-password"> パスワード </FieldLabel>
                                    <ul className="text-sm text-muted-foreground list-disc ml-5">
                                        <li> 8〜20文字で入力してください </li>
                                        <li> 大文字と小文字をそれぞれ1文字以上含めてください </li>
                                        <li> 数字を1文字以上含めてください </li>
                                        <li> 記号を1文字以上含めてください </li>
                                    </ul>
                                    <Input { ...field } id="signup-form-password" type="password" aria-invalid={fieldState.invalid} placeholder="●●●●●●●●" autoComplete="off" />
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
                <Button type="submit" form="signup-form" className="w-full" disabled={isSubmitting}> { isSubmitting ? "送信中..." : "次へ" } </Button>
            </CardFooter>

        </Card>

    )
}

export default SignupForm
