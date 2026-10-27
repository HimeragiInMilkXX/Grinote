"use client"

import { TaskNodeType } from '@/types/flow';
import { useNodesInitialized, ReactFlow, Background, Controls, useNodesState, useEdgesState, MiniMap, Edge, NodeMouseHandler, Panel } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useDragControls, motion } from "motion/react"
import { useCallback, useEffect, useState } from 'react';
import FlowProcessLoading from './flow-process-loading';
import NodeDataConfirmPanel from './node-data-confirm-panel';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { redirect } from 'next/navigation';
import TaskNodePick from './task-node-pick';

// ADD NEW CUSTOM NODE TYPE
const nodeTypes = {
    taskNode: TaskNodePick
}

interface FlowReadOnlyClientProps {

    initialNodes: TaskNodeType[];
    initialEdges: Edge[];
    project_id: string;
    getLayoutedElements: ( nodes: TaskNodeType[], edges: Edge[] ) => any
}

const FlowReadOnlyClient = ( { initialNodes, initialEdges, getLayoutedElements, project_id }: FlowReadOnlyClientProps ) => {

    const nodesInitialized = useNodesInitialized();

    const [ nodes, setNodes, onNodesChange ] = useNodesState(initialNodes);
    const [ edges, setEdges, onEdgesChange ] = useEdgesState(initialEdges)

    const [ showEditor, setShowEditor ] = useState<boolean>( false )

    const [ selectedNode, setSelectedNode ] = useState<TaskNodeType | null>();

    const onContextMenu = useCallback(

        ( e: any ) => {

            e.preventDefault();
            e.stopPropagation();

        }, []

    )

    const onNodeClick = useCallback<NodeMouseHandler<TaskNodeType>>( ( e, node )  => {

        e.stopPropagation();

        if( node.data.task.isCompleted || node.data.task.isRoot ) {

            setShowEditor( false );
            setSelectedNode( null );
            return;
            
        }

        setShowEditor( true )

        setSelectedNode( node )

    }, [setSelectedNode, setShowEditor] )

    const onPaneClick = useCallback( ( e: any ) => {

        e.stopPropagation();

        setSelectedNode(null);

        setShowEditor( false )

    }, [setSelectedNode, setShowEditor])

    const dragControls = useDragControls();

    const layoutNodes = useCallback( () => {

        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements( nodes, edges );

        setNodes( [...layoutedNodes] );
        setEdges( [...layoutedEdges] );

    }, [ nodes, edges ] );

    useEffect( () => {

        layoutNodes();

    }, [])

    return (
        <div className='w-full h-screen'>

            { (!nodesInitialized && nodes.length != 0) && <FlowProcessLoading/> }

            <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onEdgeContextMenu={onContextMenu}
                onContextMenu={onContextMenu}
                onNodeContextMenu={onContextMenu}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                nodesConnectable={false}
                nodesDraggable={false}
                fitView>
                <MiniMap />
                <Background/>

                <Panel position='top-right'>

                    { showEditor && selectedNode ?
                        <motion.div
                            drag
                            dragControls={dragControls}
                            dragListener={false}
                            dragMomentum={false}
                            className="nodrag">
                            <NodeDataConfirmPanel project_id={project_id} selectedNode={selectedNode} onPointerDown={e => dragControls.start(e)}/>
                        </motion.div>
                        : <p className='text-2xl'>今日はどれにしますか？</p> }

                </Panel>

                {

                    nodes.length <= 1 &&
                    <Panel position='bottom-center'>
                        <Card>
                            <CardContent className='flex flex-col gap-3'>
                                <p className='text-xl'> まだタスクなさそうですね！ </p>
                                <Button onClick={() => redirect(`/project/${project_id}/tree/edit`)}> まずは作ろう </Button>
                            </CardContent>
                        </Card>
                    </Panel>

                }

            </ReactFlow>

        </div>
    )
}

export default FlowReadOnlyClient
