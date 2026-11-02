"use client"

import TestXPBar, { XpBarHandle } from "@/components/dev/xp-bar"
import { Button } from "@/components/ui/button";
import { useRef } from "react";

const TestPage = () => {

    const xpBarRef = useRef<XpBarHandle>(null);

    return (

        <div className="m-6 flex flex-col gap-3 items-start">
            <TestXPBar ref={xpBarRef} initLevel={3} initTotalXp={155} growth_step={{"1": 50, "5": 100, "10": 150, "25": 200, "45": 400, "50": 500}}/>
            <Button onClick={() => xpBarRef.current?.handleXpGain(5)}> ADD 5 </Button>
            <Button onClick={() => xpBarRef.current?.handleXpGain(10)}> ADD 10 </Button>
            <Button onClick={() => xpBarRef.current?.handleXpGain(200)}> ADD 200 </Button>
        </div>

    )

}

export default TestPage
