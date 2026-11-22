'use client'

import { Search } from "lucide-react"
import { Input } from "../ui/input"
import { useRef } from "react"
import { Button } from "../ui/button"
import { cn } from "cn"

const Searchbar = ( { handleSearch, className = "" }: { handleSearch: ( query: string, page?: number, pageSize?: number ) => void, className?: string }) => {

    const inputRef = useRef<HTMLInputElement | null>(null);

    const searchWithInputValue = () => {

        if( !inputRef.current ) return;

        handleSearch( inputRef.current.value );

    }

    return (
        <div className={ cn( className, "items-center flex gap-3" ) }>

            <div className="relative grow">
                <Input
                    className="pl-8.5 pr-4"
                    placeholder="Enter keyword..."
                    ref={inputRef}
                    onKeyDown={(e) => { if( e.key === "Enter" ) searchWithInputValue() }}
                    onBlur={(e) => handleSearch(e.target.value)}/>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={12}/>
            </div>

            <Button variant="ghost" className="bg-yellow-300 hover:bg-yellow-400 px-4.5 py-4" onClick={searchWithInputValue}> Search </Button>

        </div>
    )

}

export default Searchbar
