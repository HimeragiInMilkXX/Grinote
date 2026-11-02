"use client";

import { atom, useAtom } from "jotai"
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export const isLoadingAtom = atom<boolean>(false);

const LoadingOverlay = () => {

    const [ isLoading, setIsLoading ] = useAtom(isLoadingAtom);

    const pathname = usePathname();

    useEffect( () => setIsLoading( false ), [pathname] );

    return (
        <>
            {
                isLoading &&
                    <div className='h-screen w-screen flex justify-center items-center absolute inset-0 bg-white/50 z-100'>
                        Loading...
                    </div>
            }
        </>
    )
}

export default LoadingOverlay
