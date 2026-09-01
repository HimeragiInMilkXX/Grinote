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

    email: z.email( "Please enter a valid email address." ),
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

    async function onSubmit( data: z.infer<typeof loginFormSchema> ) {

        await login( data );

    }

    return (

        <Card className="w-full sm:max-w-md">

            <CardHeader>
                <CardTitle> Login </CardTitle>
                <CardDescription> login to your account on Grinote mvp </CardDescription>
                <Link href="/signup" className="text-blue-500 underline text-xs"> sign up here if you don't have an account </Link>
            </CardHeader>

            <CardContent>
                <form id="login-form" onSubmit={form.handleSubmit(onSubmit)}>
                    <FieldGroup>
                        <Controller
                            name="email"
                            control={form.control}
                            render={ ( { field, fieldState } ) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="login-form-email"> Email </FieldLabel>
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
                                    <FieldLabel htmlFor="login-form-password"> Password </FieldLabel>
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
                <Button type="submit" form="login-form" className="w-full"> Login </Button>
            </CardFooter>

        </Card>

    )
}

export default LoginForm
