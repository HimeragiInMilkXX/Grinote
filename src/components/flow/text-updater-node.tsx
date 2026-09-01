"use client"

import { useCallback } from "react";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Handle, Position } from "@xyflow/react";

export default function TextUpdaterNode(props) {
    const onChange = useCallback((evt) => {
        console.log(evt.target.value);
    }, []);
    
    return (
        <div className="bg-white p-3 border flex flex-col gap-1.5">
            <Label htmlFor="text">Text:</Label>
            <Input id="text" name="text" onChange={onChange} className="nodrag" />
            <Handle type="target" position={Position.Top}/>
            <Handle type="source" position={Position.Bottom}/>
        </div>
    );
}