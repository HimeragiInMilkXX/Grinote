"use client"

import { TaskNodeType } from "@/types/flow"
import { Background, Controls, Edge, Panel, ReactFlow, useEdgesState, useNodesState } from "@xyflow/react"
import { getLayoutedElements } from "@/app/project/[projectId]/tree/clientActions";
import { Button } from "@/components/ui/button";
import PreviewTaskNode from "./preview-task-node";

const nodeTypes = {

    taskNode: PreviewTaskNode

}

type PreviewClientProps = {

    initialNodes: TaskNodeType[];
    initialEdges: Edge[];

}

/** Read-only preview of a graph. It is mounted fresh each time the dialog opens, so initial state is enough. */
const PreviewClient = ( { initialNodes, initialEdges }: PreviewClientProps ) => {

    const [ nodes, setNodes ] = useNodesState<TaskNodeType>( initialNodes );
    const [ edges, setEdges ] = useEdgesState<Edge>( initialEdges );

    const layoutNodes = () => {

        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements( nodes, edges );

        setNodes( layoutedNodes );
        setEdges( layoutedEdges );

    };

    return (
        <div className="w-full aspect-video">

            { nodes.length > 0 && (

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
