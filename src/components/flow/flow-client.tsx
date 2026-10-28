"use client"

import FlowContextMenu from '@/components/flow/flow-context-menu';
import NodeContextMenu from '@/components/flow/node-context-menu';
import NodeDataDisplayEditor from '@/components/flow/node-data-display-editor';
import TaskNode from '@/components/flow/task-node';
import { TaskNodeType } from '@/types/flow';
import { useNodesInitialized, ReactFlow, Background, Controls, useNodesState, useEdgesState, addEdge, MiniMap, Edge, useReactFlow, EdgeMouseHandler, NodeMouseHandler, Node, Panel, ConnectionLineType, getOutgoers, ReactFlowInstance, ReactFlowJsonObject } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useDragControls, motion } from "motion/react"
import { useCallback, useEffect, useRef, useState } from 'react';
import FlowProcessLoading from './flow-process-loading';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { getActiveTask } from '@/app/project/[projectId]/onair/serverActions';
import { updateTutorialProgress } from '@/app/project/[projectId]/serverActions';
import { toast } from 'sonner';

// ADD NEW CUSTOM NODE TYPE
const nodeTypes = {
    taskNode: TaskNode
}

interface FlowClientProps {

    initialNodes: TaskNodeType[];
    initialEdges: Edge[];
    project_id: string;
    getLayoutedElements: ( nodes: TaskNodeType[], edges: Edge[] ) => any
    saveGraphToNodes: ( rawData: ReactFlowJsonObject<TaskNodeType, Edge>, project_id: string ) => Promise<void>;

}

const FlowClient = ( { initialNodes, initialEdges, getLayoutedElements, saveGraphToNodes, project_id }: FlowClientProps ) => {

    const nodesInitialized = useNodesInitialized();

    const [ nodes, setNodes, onNodesChange ] = useNodesState(initialNodes);
    const [ edges, setEdges, onEdgesChange ] = useEdgesState(initialEdges)

    const flowRef = useRef(null);

    const [ hasActiveTask, setHasActiveTask ] = useState( false );

    useEffect( () => {

        getActiveTask( project_id ).then( res => setHasActiveTask( res != null ) );

    }, [project_id])

    const { deleteElements, addNodes, screenToFlowPosition, updateNode, addEdges } = useReactFlow();

    const onConnect = useCallback(
        ( params: any ) => {
            if( hasActiveTask ) return;
            setEdges( edgesSnapshot => addEdge( { ...params, type: ConnectionLineType.SmoothStep, animated: true }, edgesSnapshot ) )
        },
        [ hasActiveTask ]
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

            if( hasActiveTask ) return;

            deleteElements({
                edges: [{ id: edge.id }],
            });

        }, [ hasActiveTask ]

    )

    const [ showMenu, setShowMenu ] = useState<boolean>(false)
    const [ showNodeMenu, setShowNodeMenu ] = useState<boolean>(false);
    const [ menuPosition, setMenuPosition ] = useState<{ x: number, y: number }>();
    const [ showEditor, setShowEditor ] = useState<boolean>( false )

    const [ selectedNode, setSelectedNode ] = useState<TaskNodeType | null>();

    const onContextMenu = useCallback(

        ( e: any ) => {

            e.preventDefault();
            e.stopPropagation();

            if( hasActiveTask ) return;

            setShowNodeMenu( false )
            setShowMenu( true )

            setMenuPosition({
                x: e.clientX ?? 0,
                y: e.clientY ?? 0
            });

        }, [setShowMenu, hasActiveTask ]

    )

    const onNodeContextMenu = (e: any, node: TaskNodeType) => {

        if( hasActiveTask ) return;

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

        (e: any) => {

            e.preventDefault();
            e.stopPropagation();

            if( hasActiveTask ) return;

            closeAllMenus()
            setSelectedNode(null)

        }, [setShowMenu, setShowNodeMenu, setSelectedNode, hasActiveTask ]

    )

    const closeAllMenus = useCallback( () => {
        setShowMenu(false);
        setShowNodeMenu(false);
        setShowEditor(false);
    }, [setShowMenu, setShowNodeMenu, setShowEditor] )

    const onNodeClick = useCallback<NodeMouseHandler<TaskNodeType>>( ( e, node )  => {

        e.stopPropagation();

        if( hasActiveTask ) return;

        setShowMenu(false);
        setShowNodeMenu(false);

        if( node.data.task.isCompleted || node.data.task.isRoot ) {

            setSelectedNode( null );
            updateNode( node.id, { selected: false } );
            return;

        }

        setSelectedNode( node )

    }, [setShowMenu, setShowNodeMenu, setSelectedNode, hasActiveTask ] )

    const dragControls = useDragControls();

    // MENU ACTIONS
    const startViewing = () => {

        setShowEditor(true);
        setShowNodeMenu( false );

    }

    const deleteNode = () => {

        if( hasActiveTask ) return;

        if( !selectedNode ) return;

        deleteElements({
            nodes: [{ id: selectedNode.id }],
        });

        setSelectedNode( null );
        closeAllMenus();

        setRequiresSaveAction( true );

    }

    const duplicateNode = (e: any) => {

        if( hasActiveTask ) return;

        if( !selectedNode ) return;

        updateNode( selectedNode.id, { selected: false } );

        const newNode: TaskNodeType = {

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

        setRequiresSaveAction( true );

    }

    // FOR AGENT
    const insertByInput = ( nodes: string, edges: string ) => {

        if( hasActiveTask ) return;

        if( selectedNode ) updateNode( selectedNode.id, { selected: false } );

        const newNode: TaskNodeType[] = JSON.parse(nodes);
        const newEdges: Edge[] = JSON.parse( edges );

        closeAllMenus()
        setSelectedNode(null)

        addNodes( newNode )
        addEdges( newEdges );

        layoutNodes();

        updateTutorialProgress(project_id, 0).then( res => { if(res) toast.success("「目標ツリーを確認・編集する」達成！次はそれを保存しよう！", { position: "top-left" }) } );

    }

    const insertNewTask = (e: any, isLoop: boolean = false, isAction: boolean = false ) => {

        if( hasActiveTask ) return;

        if( selectedNode ) updateNode( selectedNode.id, { selected: false } );

        const newNode: TaskNodeType = {

            id: crypto.randomUUID(),
            position: screenToFlowPosition({ x: e.clientX, y: e.clientY }),
            selected: true,
            data: { label: isAction ? ( isLoop ? '繰り返し行動' : '行動' ) : "レーベル", task: {

                task_name: isAction ? ( isLoop ? '繰り返し行動' : '行動' ) : "レーベル",
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

        updateTutorialProgress(project_id, 0).then( res => { if(res) toast.success("「目標ツリーを確認・編集する」達成！次はそれを保存しよう！", { position: "top-left" }) } );

    }

    const layoutNodes = useCallback( () => {
        
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements( nodes, edges );

        setNodes( [...layoutedNodes] );
        setEdges( [...layoutedEdges] );

        closeAllMenus();

    }, [ nodes, edges ] );

    const [ rfInstance, setRfInstance ] = useState<ReactFlowInstance<TaskNodeType, Edge>>();

    const [ isSaving, setIsSaving ] = useState(false);

    const saveGraph = useCallback( async () => {

        if( hasActiveTask || isSaving ) return;

        if( !rfInstance ) return;

        try {

            setIsSaving(true)

            await saveGraphToNodes( rfInstance.toObject(), project_id );

            toast.success("変更は保存されました！", { position: "top-left" });

            closeAllMenus();
            setRequiresSaveAction(false)

            const tutorialUpdated = await updateTutorialProgress(project_id, 1);
            if( tutorialUpdated ) toast.success("「ツリーを保存する」達成！次はタスク一つ開始しよう！", { position: "top-left" });

        } catch {

            toast.error("保存に失敗しました。もう一度お試しください。", { position: "top-left" });

        }

        setIsSaving( false );

    }, [rfInstance, hasActiveTask, project_id, saveGraphToNodes, closeAllMenus, isSaving ] )

    const [ requiresSaveAction, setRequiresSaveAction ] = useState<boolean>(false);

    useEffect( () => {

        setRequiresSaveAction( ( initialNodes.length != nodes.length ) || ( initialEdges.length != edges.length ) )

    }, [nodes.length, edges.length])

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

                { menuPosition &&  <>

                    { showMenu && <FlowContextMenu x={menuPosition.x} y={menuPosition.y} insertNewTask={insertNewTask} layoutNodes={layoutNodes} saveGraph={saveGraph} insertByInput={insertByInput}/> }
                    { showNodeMenu && <NodeContextMenu x={menuPosition.x} y={menuPosition.y} startViewing={startViewing} deleteNode={deleteNode} duplicateNode={duplicateNode}/> }

                </>}

                <Panel position='top-right'>

                    { showEditor && selectedNode ?
                        <motion.div
                            drag
                            dragControls={dragControls}
                            dragListener={false}
                            dragMomentum={false}
                            className="nodrag">
                            <NodeDataDisplayEditor selectedNode={selectedNode} onPointerDown={e => dragControls.start(e)} requiresSaveAction={() => setRequiresSaveAction(true)}/>
                        </motion.div>
                        : <p className='text-2xl'> 右クリックから始めましょう！ </p> }

                </Panel>

                {

                    requiresSaveAction &&
                    <Panel position='bottom-center'>
                        <Card>
                            <CardContent className='flex flex-col gap-3'>
                                <p className='text-xl text-red-600'> 保存されていない変更内容がある </p>
                                <Button onClick={saveGraph}> 今保存する </Button>
                            </CardContent>
                        </Card>
                    </Panel>

                }

                {

                    hasActiveTask &&
                    <Panel position='bottom-center'>
                        <Card>
                            <CardContent className='flex flex-col gap-3'>
                                <p className='text-xl text-red-600'> 行動中は編集できない </p>
                            </CardContent>
                        </Card>
                    </Panel>

                }

            </ReactFlow>

        </div>
    )
}

export default FlowClient
