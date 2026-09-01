"use client"

import { logout } from "@/app/(auth)/actions";
import { Button } from "../ui/button";

export default function LogoutButton() {

    return (

        <Button onClick={logout}>
            Logout
        </Button>

    )

}