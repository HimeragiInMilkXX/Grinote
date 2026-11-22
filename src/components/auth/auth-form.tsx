"use client";

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod/v4"
import { Field, FieldError, FieldGroup, FieldLabel } from "../ui/field"
import { Input } from "../ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card"
import { Button } from "../ui/button"
import Link from "next/link";
import PasswordInput from "../miscellaneous/password-input";
import { AuthActionResult, AuthFormValues } from "./schemas";

type AuthFormProps = {

    id: string;
    schema: z.ZodType<AuthFormValues, AuthFormValues>;
    action: ( data: AuthFormValues ) => Promise<AuthActionResult | void>;
    title: string;
    description: string;
    link: { href: string, label: string };
    passwordHint?: React.ReactNode;

}

/** Email + password card shared by the login and signup pages. */
const AuthForm = ( { id, schema, action, title, description, link, passwordHint }: AuthFormProps ) => {

    const form = useForm<AuthFormValues>( {

        resolver: zodResolver( schema ),
        defaultValues: {

            email: "",
            password: ""

        }

    } )

    const { isSubmitting, errors } = form.formState;

    async function onSubmit( data: AuthFormValues ) {

        // On success the action redirects; otherwise it returns an error message
        const result = await action( data );

        if( result?.error ) form.setError( "root", { message: result.error } );

    }

    return (

        <Card className="w-full sm:max-w-md">

            <CardHeader>
                <CardTitle> {title} </CardTitle>
                <CardDescription> {description} </CardDescription>
                <Link href={link.href} className="text-blue-500 underline text-xs"> {link.label} </Link>
            </CardHeader>

            <CardContent>
                <form id={id} onSubmit={form.handleSubmit(onSubmit)}>
                    <FieldGroup>
                        <Controller
                            name="email"
                            control={form.control}
                            render={ ( { field, fieldState } ) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor={`${id}-email`}> メールアドレス </FieldLabel>
                                    <Input { ...field } id={`${id}-email`} type="email" aria-invalid={fieldState.invalid} placeholder="user@example.com" autoComplete="off" />
                                    { fieldState.invalid && <FieldError errors={[fieldState.error]} /> }
                                </Field>
                            )}
                        />
                        <Controller
                            name="password"
                            control={form.control}
                            render={ ( { field, fieldState } ) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor={`${id}-password`}> パスワード </FieldLabel>
                                    {passwordHint}
                                    <PasswordInput { ...field } id={`${id}-password`} type="password" aria-invalid={fieldState.invalid} placeholder="●●●●●●●●" autoComplete="off" />
                                    { fieldState.invalid && <FieldError errors={[fieldState.error]} /> }
                                </Field>
                            )}
                        />
                        { errors.root && <FieldError errors={[errors.root]} /> }
                    </FieldGroup>
                </form>
            </CardContent>

            <CardFooter>
                <Button type="submit" form={id} className="w-full" disabled={isSubmitting}> { isSubmitting ? "送信中..." : "次へ" } </Button>
            </CardFooter>

        </Card>

    )
}

export default AuthForm
