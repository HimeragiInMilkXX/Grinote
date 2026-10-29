"use client"

import { useState } from "react";
import { Input } from "../ui/input"
import { Eye, EyeOff } from "lucide-react";

const PasswordInput = ( { className, ...props }: React.ComponentProps<"input"> ) => {

    const [ viewing, setViewing ] = useState<boolean>(false);

    return (
        
        <div className="relative">

            <Input {...props} className={`${className} pr-11`} type={viewing ? 'text' : 'password'} />

            { viewing ?
                <EyeOff onClick={() => setViewing( v => !v )} className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-50" size={20}/> :
                <Eye onClick={() => setViewing( v => !v )} className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-50" size={20}/>
            }

        </div>

    )
}

export default PasswordInput
