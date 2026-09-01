"use client";

import { login } from "@/app/(auth)/actions"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod/v4"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "../ui/field"
import { Input } from "../ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card"
import { Button } from "../ui/button"
import Link from "next/link";

export const signupFormSchema = z.object({

    email: z.email( "Please enter a valid email address." ),
    password: z.string()
        .min(8, "Password must be at least 8 characters long")
        .max(20, "Password must be less than 20 characters long")
        .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
        .regex(/[a-z]/, "Password must contain at least one lowercase letter")
        .regex(/[0-9]/, "Password must contain at least one number")
        .regex(/[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/?]/, "Password must contain at least one special character")

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

            await login( data );

        } catch( e: any ) {

            console.log( e.message );

        }

    }

    return (

        <Card className="w-full sm:max-w-md">

            <CardHeader>
                <CardTitle> Sign Up </CardTitle>
                <CardDescription> sign up your account to access Grinote mvp </CardDescription>
                <Link href="/login" className="text-blue-500 underline text-xs"> login here if you already have an account </Link>
            </CardHeader>

            <CardContent>
                <form id="signup-form" onSubmit={form.handleSubmit(onSubmit)}>
                    <FieldGroup>
                        <Controller
                            name="email"
                            control={form.control}
                            render={ ( { field, fieldState } ) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="signup-form-email"> Email </FieldLabel>
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
                                    <FieldLabel htmlFor="signup-form-password"> Password </FieldLabel>
                                    <ul className="text-sm text-muted-foreground list-disc ml-5">
                                        <li> Must contain 8~20 characters </li>
                                        <li> Must contain at least one uppercase letter and one lowercase letter </li>
                                        <li> Must contain at least one number </li>
                                        <li> Must contain at least one special character </li>
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
                <Button type="submit" form="signup-form" className="w-full"> Sign Up </Button>
            </CardFooter>

        </Card>

    )
}

export default SignupForm
