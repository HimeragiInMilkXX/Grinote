"use client"

import { useEffect, useState } from "react";

export function useSyncedDuration( updated_at: Date | string, duration: number, status: "paused" | "active" | "abandoned" | "completed" ) {

    const [ isRunning, setIsRunning ] = useState( status === "active" );

    const [ elapsedMs, setElapsedMs ] = useState(0);

    const updatedTime = new Date( updated_at ).getTime();

    useEffect( () => {

        const updateTimer = () => setElapsedMs( isRunning ? ( duration + ( Date.now() - updatedTime ) ) : duration );

        if( !isRunning ) return;

        const interval = setInterval( updateTimer, 1000 );

        return () => clearInterval( interval );

    }, [updatedTime, duration, isRunning ])

    return { startTimer: () => setIsRunning(true), pauseTimer: () => setIsRunning(false), elapsedMs, isRunning }

}