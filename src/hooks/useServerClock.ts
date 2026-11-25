"use client"

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Client clock corrected to the server's (timer timestamps are server time). Starts at
 * `serverNow` so the first client render matches the server render; ticks every 250 ms.
 * Call `sync(serverNow)` with the time a server action returned.
 */
export function useServerClock( serverNow: number ) {

    const offset = useRef( 0 );
    const [ now, setNow ] = useState( serverNow );

    const sync = useCallback( ( server: number ) => {
        offset.current = server - Date.now();
        setNow( Date.now() + offset.current );
    }, [] );

    useEffect( () => {
        sync( serverNow );
        const id = setInterval( () => setNow( Date.now() + offset.current ), 250 );
        return () => clearInterval( id );
    }, [ serverNow, sync ] );

    return { now, sync };

}
