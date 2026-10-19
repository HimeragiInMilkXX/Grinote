"use client"

import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import ApproachTutorialCarousel from "./carousel/approach-tutorial-carousel";
import { buttonVariants } from "@/components/ui/button";
import { useState } from "react";

export default function ApproachTutorialDialog( { isIntroductionDone }: { isIntroductionDone: boolean }) {

    const [ open, isOpen ] = useState( !isIntroductionDone )

    return (

        <Dialog open={isIntroductionDone ? open : !isIntroductionDone} onOpenChange={(o: boolean) => isOpen(o)}>
            <DialogTrigger className={buttonVariants({ variant: "secondary" })}>Grinoteへようこそ</DialogTrigger>
            <DialogContent className="w-[40vw] max-w-none! p-8 pb-4" showCloseButton={isIntroductionDone}>
                <ApproachTutorialCarousel/>
            </DialogContent>
        </Dialog>

    )

}