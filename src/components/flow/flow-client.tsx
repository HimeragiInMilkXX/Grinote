"use client"

import FlowContextMenu, { ContextMenuProps } from '@/components/flow/flow-context-menu';
import NodeContextMenu from '@/components/flow/node-context-menu';
import NodeDataDisplayEditor from '@/components/flow/node-data-display-editor';
import TaskNode from '@/components/flow/task-node';
import { TaskNodeType } from '@/types/flow';
import { useNodesInitialized, ReactFlow, Background, Controls, useNodesState, useEdgesState, addEdge, MiniMap, Edge, useReactFlow, EdgeMouseHandler, ReactFlowProvider, NodeMouseHandler, Node, Panel, ConnectionLineType, getOutgoers, ReactFlowInstance, ReactFlowJsonObject } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useDragControls, motion } from "motion/react"
import { useCallback, useEffect, useRef, useState } from 'react';
import FlowProcessLoading from './flow-process-loading';

// ADD NEW CUSTOM NODE TYPE
const nodeTypes = {
    taskNode: TaskNode
}

interface FlowClientProps {

    initialNodes: TaskNodeType[];
    initialEdges: Edge[];
    project_id: string;
    getLayoutedElements: ( nodes: TaskNodeType[], edges: Edge[] ) => any
    saveGraphToNodes: ( rawData: ReactFlowJsonObject<TaskNodeType, Edge>, project_id: string ) => void;

}

const FlowClient = ( { initialNodes, initialEdges, getLayoutedElements, saveGraphToNodes, project_id }: FlowClientProps ) => {

    const nodesInitialized = useNodesInitialized();

    const [ nodes, setNodes, onNodesChange ] = useNodesState(initialNodes);
    const [ edges, setEdges, onEdgesChange ] = useEdgesState(initialEdges)

    const flowRef = useRef(null);

    const { deleteElements, addNodes, screenToFlowPosition, updateNode } = useReactFlow();

    const onConnect = useCallback(
        ( params: any ) => setEdges( edgesSnapshot => addEdge( { ...params, type: ConnectionLineType.SmoothStep, animated: true }, edgesSnapshot ) ),
        []
    )

    const isValidConnection = useCallback(
        (connection: any) => {

            const target = nodes.find((node) => node.id === connection.target);

            if( !target ) return false;

            const source = nodes.find( node => node.id === connection.source );

            if( source?.data.task.isCompleted ) return false;

            const targetAlreadyHasParent = edges.some((edge) => edge.target === connection.target);
            if ( targetAlreadyHasParent ) return false;

            const hasCycle = (node: Node, visited = new Set()) => {

                if (visited.has(node.id)) return false;

                visited.add(node.id);

                for (const outgoer of getOutgoers(node, nodes, edges)) {
                    if (outgoer.id === connection.source) return true;
                    if (hasCycle(outgoer, visited)) return true;
                }

            };

            if (target?.id === connection.source) return false;
            return !hasCycle(target);
        },
        [nodes, edges],
    );

    const onEdgeContextMenu = useCallback<EdgeMouseHandler>(

        (e, edge: Edge) => {

            e.preventDefault();
            e.stopPropagation();

            deleteElements({
                edges: [{ id: edge.id }],
            });

        }, []

    )

    const [ showMenu, setShowMenu ] = useState<boolean>(false)
    const [ showNodeMenu, setShowNodeMenu ] = useState<boolean>(false);
    const [ menuPosition, setMenuPosition ] = useState<{ x: number, y: number }>();
    const [ showEditor, setShowEditor ] = useState<boolean>( false )

    const [ selectedNode, setSelectedNode ] = useState<TaskNodeType | null>();

    const onContextMenu = useCallback(

        ( e ) => {

            e.preventDefault();
            e.stopPropagation();

            setShowNodeMenu( false )
            setShowMenu( true )

            setMenuPosition({
                x: e.clientX ?? 0,
                y: e.clientY ?? 0
            });

        }, [setShowMenu]

    )

    const onNodeContextMenu = (e: any, node: TaskNodeType) => {

        e.preventDefault();
        e.stopPropagation();

        if( node.data.task.isCompleted || node.data.task.isRoot ) {

            setSelectedNode( null );
            updateNode( node.id, { selected: false } );
            return;

        }

        if( selectedNode ) updateNode( selectedNode.id, { selected: false } );

        setSelectedNode( node );

        updateNode( node.id, { selected: true } );

        setShowMenu( false )
        setShowNodeMenu( true )

        setMenuPosition({
            x: e.clientX ?? 0,
            y: e.clientY ?? 0
        });

    }

    const onPaneClick = useCallback(

        e => {

            e.preventDefault();
            e.stopPropagation();
            closeAllMenus()
            setSelectedNode(null)

        }, [setShowMenu, setShowNodeMenu, setSelectedNode]

    )

    const closeAllMenus = useCallback( () => {
        setShowMenu(false);
        setShowNodeMenu(false);
        setShowEditor(false);
    }, [setShowMenu, setShowNodeMenu, setShowEditor] )

    const onNodeClick = useCallback<NodeMouseHandler<TaskNodeType>>( ( e, node )  => {

        e.stopPropagation();

        setShowMenu(false);
        setShowNodeMenu(false);

        if( node.data.task.isCompleted || node.data.task.isRoot ) {

            setSelectedNode( null );
            updateNode( node.id, { selected: false } );
            return;

        }

        setSelectedNode( node )

    }, [setShowMenu, setShowNodeMenu, setSelectedNode] )

    const dragControls = useDragControls();

    // MENU ACTIONS
    const startViewing = () => {

        setShowEditor(true);
        setShowNodeMenu( false );

    }

    const deleteNode = () => {

        if( !selectedNode ) return;

        deleteElements({
            nodes: [{ id: selectedNode.id }],
        });

        setSelectedNode( null );
        closeAllMenus();

    }

    const duplicateNode = (e: any) => {

        if( !selectedNode ) return;

        updateNode( selectedNode.id, { selected: false } );

        const newNode = {

            id: crypto.randomUUID(),
            selected: true,
            position: screenToFlowPosition( { x: e.clientX, y: e.clientY } ),
            data: selectedNode.data,
            type: 'taskNode',

        }

        onPaneClick(e);

        addNodes( newNode )
        setSelectedNode( newNode );

        setShowEditor( true );

    }

    const insertNewTask = (e: any, isLoop: boolean = false, isAction: boolean = false ) => {

        if( selectedNode ) updateNode( selectedNode.id, { selected: false } );

        const newNode: TaskNodeType = {

            id: crypto.randomUUID(),
            position: screenToFlowPosition({ x: e.clientX, y: e.clientY }),
            selected: true,
            data: { label: isAction ? ( isLoop ? '繰り返し行動' : '行動' ) : "タスク", task: {

                task_name: isAction ? ( isLoop ? '繰り返し行動' : '行動' ) : "タスク",
                bg_color: "#FFFFFF",
                text_color: "#000000",
                description: "",
                time_limit: { hours: 0, minutes: 2, seconds: 0 },
                isLoop: isLoop,
                repetitions_required: 2,
                isCompleted: false,
                isAction: isAction,
                repetitions_completed: 0,
                isRoot: false

                }
            },
            type: 'taskNode',

        }

        onPaneClick(e);

        addNodes( newNode )
        setSelectedNode( newNode );

        setShowEditor( true );

    }

    const layoutNodes = useCallback( () => {

        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements( nodes, edges );

        setNodes( [...layoutedNodes] );
        setEdges( [...layoutedEdges] );

        closeAllMenus();

    }, [ nodes, edges ] );

    const [ rfInstance, setRfInstance ] = useState<ReactFlowInstance<TaskNodeType, Edge>>();

    const saveGraph = useCallback( () => {

        if( rfInstance ) saveGraphToNodes( rfInstance.toObject(), project_id );

        closeAllMenus();

    }, [rfInstance] )

    useEffect( () => {

        layoutNodes();

    }, [])

    return (
        <div className='w-full h-screen'>

            { (!nodesInitialized && nodes.length != 0) && <FlowProcessLoading/> }

            <ReactFlow ref={flowRef} nodes={nodes} edges={edges} nodeTypes={nodeTypes}
                onInit={setRfInstance}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onEdgeContextMenu={onEdgeContextMenu}
                onContextMenu={onContextMenu}
                onNodeContextMenu={onNodeContextMenu}
                onPaneClick={onPaneClick}
                onNodeClick={onNodeClick}
                isValidConnection={isValidConnection}
                fitView>
                <MiniMap />
                <Background/>
                <Controls position='top-right' />

                { menuPosition &&  <>

                    { showMenu && <FlowContextMenu x={menuPosition.x} y={menuPosition.y} insertNewTask={insertNewTask} layoutNodes={layoutNodes} saveGraph={saveGraph}/> }
                    { showNodeMenu && <NodeContextMenu x={menuPosition.x} y={menuPosition.y} startViewing={startViewing} deleteNode={deleteNode} duplicateNode={duplicateNode}/> }

                </>}

                <Panel position='top-left'>

                    { showEditor && selectedNode ?
                        <motion.div
                            drag
                            dragControls={dragControls}
                            dragListener={false}
                            dragMomentum={false}
                            className="nodrag">
                            <NodeDataDisplayEditor selectedNode={selectedNode} onPointerDown={e => dragControls.start(e)}/>
                        </motion.div>
                        : 'Welcome To Grinote' }

                </Panel>

            </ReactFlow>

        </div>
    )
}

export default FlowClient
