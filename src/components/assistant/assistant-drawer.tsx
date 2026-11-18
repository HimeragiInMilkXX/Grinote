"use client"

import { Geist, Geist_Mono } from "next/font/google"

import { ThemeProvider } from "@/components/assistant/theme-provider"
import "@/components/assistant/styles/assistant.css"
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Maximize2, Minimize2, Sparkle } from "lucide-react"
import {useState } from "react"
import { cn } from "cn"
import { atom, useAtom, useSetAtom } from "jotai"

const fontSans = Geist({ subsets: ["latin"], variable: "--font-sans" })
const fontMono = Geist_Mono({
    subsets: ["latin"],
    variable: "--font-geist-mono",
})

export const assistantDrawerOpenAtom = atom<boolean>(false);

export default function AssistantDrawer( { children }: { children: React.ReactElement}) {

    const [ isMaximized, setIsMaximized ] = useState(false);

    const [ open, setOpen ] = useAtom(assistantDrawerOpenAtom);

    return (

        <Drawer swipeDirection="right" onOpenChangeComplete={() => setIsMaximized(false)} open={open} onOpenChange={setOpen}>
            <DrawerTrigger render={
                <Button variant="outline" className="h-10 p-3 border! shadow rounded-full flex items-center justify-center absolute right-4.5 bottom-4.5"> <Sparkle/> </Button>}/>
            <DrawerContent className={ cn( "transition-all", isMaximized ? "w-1/2" : "" ) }>
                {

                    !isMaximized ? <Maximize2 className="absolute left-6 top-6 cursor-pointer" size={16} onClick={() => setIsMaximized( v => !v )}/> :
                                   <Minimize2 className="absolute left-6 top-6 cursor-pointer" size={16} onClick={() => setIsMaximized( v => !v )}/>

                }
                <ThemeProvider fontClassName={`${fontSans.variable} ${fontMono.variable}`}>
                    {children}
                </ThemeProvider>
            </DrawerContent>
        </Drawer>

    )

}