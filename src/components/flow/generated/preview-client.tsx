"use client"

import { TaskNodeType } from "@/types/flow"
import { Background, Controls, Edge, Panel, ReactFlow, useEdgesState, useNodesState } from "@xyflow/react"
import { RefObject, useCallback, useEffect, useImperativeHandle } from "react";
import { getLayoutedElements } from "@/app/project/[projectId]/tree/clientActions";
import { Button } from "@/components/ui/button";
import PreviewTaskNode from "./preview-task-node";

const nodeTypes = {

    taskNode: PreviewTaskNode

}

export interface PreviewClientHandle {

    setPreviewNode: ( nodes: TaskNodeType[] ) => void;
    setPreviewEdge: ( edges: Edge[] ) => void;

}


const PreviewClient = ( { ref }: { ref: RefObject<PreviewClientHandle | null> }) => {

    const [ nodes, setNodes ] = useNodesState([]);
    const [ edges, setEdges ] = useEdgesState([])

    const layoutNodes = useCallback( () => {
        
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements( nodes, edges );

        setNodes( layoutedNodes );
        setEdges( layoutedEdges );

    }, [ nodes, edges ] );

    useImperativeHandle( ref, () => ({

        setPreviewNode: ( nodes: TaskNodeType[] ) => setNodes( nodes ),
        setPreviewEdge: ( edges: Edge[] ) => setEdges( edges ),

    }), [setNodes, setEdges])

    useEffect( () => { return () => {setEdges([]); setNodes([])}}, [])

    return (
        <div className="w-full aspect-video">
        
            { ( nodes.length > 0 && edges.length > 0 ) && (

                <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView>

                    <Background/>
                    <Controls/>

                    <Panel>

                        <Button onClick={layoutNodes}> レイアウト </Button>

                    </Panel>

                </ReactFlow>

            ) }

        </div>
    )
}

export default PreviewClient
