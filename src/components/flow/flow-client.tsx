"use client"

import { useCallback, useEffect, useRef, useState } from "react";
import { ReactFlow, addEdge, Node, Edge, OnConnect, applyNodeChanges, applyEdgeChanges, Background, useReactFlow, ConnectionLineType, getOutgoers, EdgeMouseHandler, Panel, OnConnectStartParams, NodeMouseHandler, ReactFlowJsonObject, ReactFlowInstance, useNodesInitialized, MiniMap, } from "@xyflow/react";
import useUndoable from "use-undoable";

import '@xyflow/react/dist/style.css';
import TaskNode from "@/components/flow/task-node";
import { TaskNodeType } from "@/types/flow";
import FlowContextMenu from "@/components/flow/flow-context-menu";
import NodeContextMenu from "@/components/flow/node-context-menu";
import { motion, useDragControls } from "motion/react";
import NodeDataDisplayEditor from "@/components/flow/node-data-display-editor";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import NodeDataConfirmPanel from "@/components/flow/node-data-confirm-panel";
import { getActiveTask } from "@/app/project/[projectId]/onair/serverActions";
import { updateTutorialProgress } from "@/app/project/[projectId]/serverActions";
import { toast } from "sonner";
import FlowProcessLoading from "@/components/flow/flow-process-loading";
import { useSetAtom } from "jotai";
import { treeRequiresSaveActionAtom } from "@/atoms/tree_requires_save_action_atom";

const nodeTypes = {
    taskNode: TaskNode
}

interface FlowClientProps {

    initialNodes: TaskNodeType[];
    initialEdges: Edge[];
    project_id: string;
    getLayoutedElements: ( nodes: TaskNodeType[], edges: Edge[] ) => any
    saveGraphToNodes: ( rawData: ReactFlowJsonObject<TaskNodeType, Edge>, project_id: string ) => Promise<void>;
    isInitialEditMode?: boolean

}

function FlowClient( { initialNodes, initialEdges, getLayoutedElements, saveGraphToNodes, project_id, isInitialEditMode = true }: FlowClientProps ) {

    const nodesInitialized = useNodesInitialized();

    // Toggle edit/pick mode
    const [ isEditMode, setIsEditMode ] = useState(isInitialEditMode);

    useEffect( () => setIsEditMode(isInitialEditMode), [isInitialEditMode])

    // Disable Drag while not in editmode
    
    // Prevent user from editing the graph while working on a task
    const [ hasActiveTask, setHasActiveTask ] = useState(false);

    useEffect( () => {

        getActiveTask( project_id ).then( res => setHasActiveTask( res != null ) );

    }, [project_id])


    // Helper functions for the graph
    const { screenToFlowPosition } = useReactFlow();


    // Ref of the ReactFlow Div Element
    const reactFlowRef = useRef<HTMLDivElement | null>(null);

    // Re-focus to the ReactFlow Div Element
    const refocusToClient = useCallback(() => {

        if( !reactFlowRef.current ) return

        reactFlowRef.current?.focus();

    }, [reactFlowRef.current])


    // elements.nodes and elements.edges are the only truth source of what's on the graph
    const [elements, setElements, { undo, canUndo, redo, canRedo }] = useUndoable(
        { nodes: initialNodes as TaskNodeType[], edges: initialEdges as Edge[] },
        { behavior: "destroyFuture" },
    );

    // Extra actions on redo/undo
    const handleReverseAction = useCallback( () => {

        closeAllMenus();
        setRequiresSaveAction(true)

    }, [undo, redo, canRedo, canUndo])

    // For when no need record history for undo/redo
    const triggerUpdate = useCallback(
        (t: any, v: any, ignore = false) => {
            setElements(
                (e) => ({
                    nodes: t === "nodes" ? v : e.nodes,
                    edges: t === "edges" ? v : e.edges,
                }),
                "destroyFuture",
                ignore,
            );
        },
        [setElements],
    );

    // Update Node properties
    const updateNode = useCallback(

        ( node_id: string, options?: any ) => {

            setElements( current => ({

                ...current,
                nodes: current.nodes.map( node => {

                    if( node_id === node.id )
                        return {

                            ...node,
                            ...options

                        }

                    return node

                })

            }), "destroyFuture", true )

        }, [ setElements, elements ]

    )


    // Triggered on edge connect attempt
    const onConnect: OnConnect = useCallback(

        (connection) => {

            if( hasActiveTask || !isEditMode ) return;

            const newEdge = { ...connection, type: ConnectionLineType.SmoothStep, animated: true };

            // update elements list
            setElements((current) => ({
                ...current,
                edges: addEdge( newEdge, current.edges )
            }));

            setRequiresSaveAction(true)

        },
        [triggerUpdate, elements, setElements, hasActiveTask, isEditMode]

    );

    // Validate the attempted edge connect(can't feed to itself/create a loop)
    const isValidConnection = useCallback(

        (connection: any) => {

            // Get the connected target
            const target = elements.nodes.find((node) => node.id === connection.target);

            if( !target ) return false;

            // Get the connection source
            const source = elements.nodes.find( node => node.id === connection.source );

            // A completed task can't initialise a connection
            if( source?.data.task.isCompleted ) return false;

            // Reject if the connected target is already connected by something else
            const targetAlreadyHasParent = elements.edges.some((edge) => edge.target === connection.target);
            if ( targetAlreadyHasParent ) return false;

            // Reject if the connection results a loop
            const hasCycle = (node: Node, visited = new Set()) => {

                if (visited.has(node.id)) return false;

                visited.add(node.id);

                for (const outgoer of getOutgoers(node, elements.nodes, elements.edges)) {
                    if (outgoer.id === connection.source) return true;
                    if (hasCycle(outgoer, visited)) return true;
                }

            };

            // Reject if it's trying to connect to itself
            if (target?.id === connection.source) return false;

            return !hasCycle(target);
        },

        [elements],

    );

    // Remove Edge on right-clicking
    const onEdgeContextMenu = useCallback<EdgeMouseHandler>(

        (e, edge: Edge) => {

            e.preventDefault();
            e.stopPropagation();

            if( hasActiveTask || !isEditMode ) return;

            // delete
            setElements((current) => ({
                ...current,
                edges: current.edges.filter((item) => item.id !== edge.id),
            }), "destroyFuture", false);

            refocusToClient()

            setRequiresSaveAction(true)

        }, [ hasActiveTask, isEditMode ]

    )


    // State of nodes that is currently selected
    const [ selectedNode, setSelectedNode ] = useState<TaskNodeType | null>();

    // Drag from handle
    const [ connectingNodeInfo, setConnectingNodeInfo ] = useState<{ node_id: string, handle_id: string } | null>();

    const onConnectStart = useCallback( ( e: any, params: OnConnectStartParams ) => {

        if( hasActiveTask || !isEditMode ) return;

        if( params.handleType === "source" && params.nodeId && params.handleId ) {

            setConnectingNodeInfo({

                node_id: params.nodeId,
                handle_id: params.handleId

            })

        }

    }, [hasActiveTask, isEditMode])

    const onConnectEnd = useCallback( ( e: any ) => {

        const target = e.target as HTMLElement | null;
        const targetIsPane = target?.classList.contains('react-flow__pane')

        if( targetIsPane && connectingNodeInfo ) {

            setMenuPosition({

                x: e.clientX,
                y: e.clientY

            })

            setShowMenu(true)

        } else {

            setConnectingNodeInfo(null)

        }

    }, [connectingNodeInfo, hasActiveTask, isEditMode])


    // Context Menu related
    const [ showMenu, setShowMenu ] = useState<boolean>(false)
    const [ showNodeMenu, setShowNodeMenu ] = useState<boolean>(false);
    const [ menuPosition, setMenuPosition ] = useState<{ x: number, y: number }>();
    const [ showEditor, setShowEditor ] = useState<boolean>( false )

    // Triggered on right-clicking blank spaces
    const onContextMenu = useCallback(

        ( e: any ) => {

            e.preventDefault();
            e.stopPropagation();

            if( hasActiveTask || !isEditMode ) return;

            setShowNodeMenu( false )
            setShowMenu( true )
            setConnectingNodeInfo(null)

            setMenuPosition({
                x: e.clientX ?? 0,
                y: e.clientY ?? 0
            });

        }, [setShowMenu, setConnectingNodeInfo, hasActiveTask, isEditMode ]

    )

    // Triggered on right-clicking nodes
    const onNodeContextMenu = useCallback( (e: any, node: TaskNodeType) => {

        e.preventDefault();
        e.stopPropagation();

        if( hasActiveTask || !isEditMode ) return;

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
        setConnectingNodeInfo(null)

        setMenuPosition({
            x: e.clientX ?? 0,
            y: e.clientY ?? 0
        });

    }, [ hasActiveTask, selectedNode, setConnectingNodeInfo, updateNode, isEditMode ] )

    // Triggered on left-clicking blank spaces
    const onPaneClick = useCallback(

        (e: any) => {

            e.preventDefault();
            e.stopPropagation();

            closeAllMenus()

            if( hasActiveTask || !isEditMode ) return;

            setSelectedNode(null)
            setConnectingNodeInfo(null)

        }, [setShowMenu, setShowNodeMenu, setSelectedNode, setConnectingNodeInfo, hasActiveTask, isEditMode ]

    )

    // Close All Menus
    const closeAllMenus = useCallback( () => {
        setShowMenu(false);
        setShowNodeMenu(false);
        setShowEditor(false);
    }, [] )


    // React to focus node change
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

        setShowEditor( true )

    }, [setShowMenu, setShowNodeMenu, setSelectedNode, hasActiveTask ] )


    // React to changes, for example to exclude some changes from undo/redo history
    const onNodesChange = useCallback(
        (changes: any) => {
            let ignore = ["dimensions", "position"].includes(changes[0].type);

            if (!changes[0].dragging && changes[0].type === "position") {
                setRequiresSaveAction(true)
                ignore = false;
            }

            triggerUpdate("nodes", applyNodeChanges(changes, elements.nodes), ignore);
            setRequiresSaveAction(true)
        },
        [triggerUpdate, elements.nodes],
    );

    const onEdgesChange = useCallback(
        (changes: any) => {
            let ignore = ["select"].includes(changes[0].type);
                triggerUpdate("edges", applyEdgeChanges(changes, elements.edges), ignore);
                setRequiresSaveAction(true)
            },
        [triggerUpdate, elements.edges],
    );


    // Keyboard shortcut for undo/redo
    const handleKeyPress = useCallback((event: any) => {

        if( hasActiveTask || !isEditMode ) return;

        //ctrl+z || ctrl+Z
        if (canUndo && event.ctrlKey && event.keyCode === 90) {
            undo();
            handleReverseAction()
        } //ctrl+y || ctrl+Y
        else if (canRedo && event.ctrlKey && event.keyCode === 89) {
            redo();
            handleReverseAction()
        }
    }, [hasActiveTask, isEditMode, canRedo, canUndo]);


    // Force Save: Route
    const [ requiresSaveAction, setRequiresSaveAction ] = useState<boolean>(false);
    const setSaveCheckAtom = useSetAtom( treeRequiresSaveActionAtom );

    useEffect( () => {

        setSaveCheckAtom( a => ({

            projectId: project_id,
            requiresSave: requiresSaveAction

        }))

    }, [ requiresSaveAction ])

    useEffect( () => { return () => setSaveCheckAtom({ projectId: null, requiresSave: false } ) }, [])

    // Force Save: Page
    useEffect(() => {

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (!requiresSaveAction) return;
            e.preventDefault();
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);

    }, [requiresSaveAction]);


    // Menu Options
    const insertNewTask = useCallback ( (e: any, isLoop: boolean = false, isAction: boolean = false ) => {

        if( hasActiveTask ) return;

        // Unfocus previous task
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

        // Add new node and set focus
        setElements((current) => ({
            ...current,
            nodes: [ ...current.nodes, newNode ]
        }), "destroyFuture", false);

        // Connect nodes if dragged from edge
        if( connectingNodeInfo ) {

            const newEdge: Edge = {

                id: `e_${connectingNodeInfo.node_id}-${newNode.id}`,
                source: connectingNodeInfo.node_id,
                sourceHandle: connectingNodeInfo.handle_id,
                target: newNode.id,
                type: "smoothstep",
                animated: true

            }

            setElements( ( current ) => ({

                ...current,
                edges: addEdge( newEdge, current.edges )

            }))

            setConnectingNodeInfo(null);

        }

        onPaneClick(e);

        setSelectedNode( newNode );

        // Show Editor Panel
        setShowEditor( true );

        setRequiresSaveAction(true)

        updateTutorialProgress(project_id, 0).then( res => { if(res) toast.success("「目標ツリーを確認・編集する」達成！次はそれを保存しよう！", { position: "top-left" }) } );

        refocusToClient()

    }, [selectedNode, hasActiveTask, connectingNodeInfo] );

    const layoutNodes = useCallback( () => {

        setElements( current => {

            const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements( current.nodes, current.edges );

            return {

                nodes: layoutedNodes as TaskNodeType[],
                edges: layoutedEdges

            }}

        )

        setRequiresSaveAction(true)

        closeAllMenus();

    }, [] );


    // SAVE
    const [ rfInstance, setRfInstance ] = useState<ReactFlowInstance<TaskNodeType, Edge>>();

    const [ isSaving, setIsSaving ] = useState(false);

    const saveGraph = useCallback( async () => {

        if( hasActiveTask || isSaving || !isEditMode ) return;

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

    }, [rfInstance, hasActiveTask, project_id, saveGraphToNodes, closeAllMenus, isSaving, isEditMode ] )


    const insertByInput = useCallback(( nodes: string, edges: string ) => {

        if( hasActiveTask ) return;

        if( selectedNode ) updateNode( selectedNode.id, { selected: false } );

        const newNode: TaskNodeType[] = JSON.parse(nodes);
        const newEdges: Edge[] = JSON.parse( edges );

        closeAllMenus()
        setSelectedNode(null)

        setElements( current => ({

            nodes: [ ...current.nodes, ...newNode ],
            edges: [ ...newEdges, ...current.edges ]

        }), "destroyFuture")

        layoutNodes();

        updateTutorialProgress(project_id, 0).then( res => { if(res) toast.success("「目標ツリーを確認・編集する」達成！次はそれを保存しよう！", { position: "top-left" }) } );

    }, [hasActiveTask, selectedNode])

    // Node Menu Options
    const startViewing = () => {

        setShowEditor(true);
        setShowNodeMenu( false );

    }

    const deleteNode = useCallback(() => {

        if( hasActiveTask ) return;

        if( !selectedNode ) return;

        setElements( current => ({

            ...current,
            nodes: current.nodes.filter( node => node.id != selectedNode.id),
            edges: current.edges.filter( edge => ( edge.source != selectedNode.id ) && ( edge.target != selectedNode.id ) )

        }), "destroyFuture", false)

        setSelectedNode( null );
        closeAllMenus();

        setRequiresSaveAction( true );

        refocusToClient()

    }, [ hasActiveTask, selectedNode ])

    const duplicateNode = useCallback((e: any) => {

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

        setElements( current => ({

            ...current,
            nodes: [ ...current.nodes, newNode ]

        }))

        setSelectedNode( newNode );

        setShowEditor( true );

        setRequiresSaveAction( true );

    }, [ hasActiveTask, selectedNode ])


    // For draggable panel
    const dragControls = useDragControls();


    // Trigger on switch mode
    useEffect( () => {

        // Reject switching if not yet saved
        if( !isEditMode && requiresSaveAction ) {
            alert("編集内容をまず保存してください")
            setIsEditMode( true );
        }

        closeAllMenus();
        refocusToClient();

    }, [isEditMode])

    return (
        <div className='w-full h-screen'>

            { (!nodesInitialized && elements.nodes.length != 0) && <FlowProcessLoading/> }

            <ReactFlow

                onInit={setRfInstance}
                ref={reactFlowRef}
                nodeTypes={nodeTypes}

                nodes={elements.nodes}
                edges={elements.edges}

                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}

                onNodeClick={onNodeClick}

                isValidConnection={isValidConnection}
                onConnect={onConnect}

                onEdgeContextMenu={onEdgeContextMenu}
                onNodeContextMenu={onNodeContextMenu}
                onContextMenu={onContextMenu}

                onPaneClick={onPaneClick}

                onKeyDown={(e) => handleKeyPress(e)}

                onConnectStart={onConnectStart}
                onConnectEnd={onConnectEnd}

                nodesConnectable={isEditMode}
                nodesDraggable={isEditMode}

                tabIndex={0}
                fitView

            >

                <Background />
                <MiniMap/>

                {/* Menu */}
                { (menuPosition && isEditMode) &&  <>

                    { showMenu && <FlowContextMenu x={menuPosition.x} y={menuPosition.y} insertNewTask={insertNewTask} layoutNodes={layoutNodes} saveGraph={saveGraph} insertByInput={insertByInput}/> }
                    { showNodeMenu && <NodeContextMenu x={menuPosition.x} y={menuPosition.y} startViewing={startViewing} deleteNode={deleteNode} duplicateNode={duplicateNode}/> }

                </>}

                {/* Editor */}
                <Panel position='top-right'>

                    { isEditMode ?

                        /* editor */
                        ( (showEditor && selectedNode) ?
                            <motion.div
                                drag
                                dragControls={dragControls}
                                dragListener={false}
                                dragMomentum={false}
                                className="nodrag">
                                <NodeDataDisplayEditor selectedNode={selectedNode} onPointerDown={e => dragControls.start(e)} requiresSaveAction={() => setRequiresSaveAction(true)}/>
                            </motion.div>
                            : <p className='text-2xl'> 右クリックから始めましょう！ </p> ) :

                        /* pick */
                        ( (showEditor && selectedNode) ?
                            <motion.div
                                drag
                                dragControls={dragControls}
                                dragListener={false}
                                dragMomentum={false}
                                className="nodrag">
                                <NodeDataConfirmPanel project_id={project_id} selectedNode={selectedNode} onPointerDown={e => dragControls.start(e)}/>
                            </motion.div>
                            : <p className='text-2xl'>今日はどれにしますか？</p> ) }

                </Panel>

                {/* Reminder to save */}
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

                {/* Reminder of not editable during onair */}
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

                {/* Reminder of if there is less than two node */}
                {

                    (elements.nodes.length <= 1 && !isEditMode) &&
                    <Panel position='bottom-center'>
                        <Card>
                            <CardContent className='flex flex-col gap-3'>
                                <p className='text-xl'> まだタスクなさそうですね！ </p>
                                <Button onClick={() => setIsEditMode(true)}> まずは作ろう </Button>
                            </CardContent>
                        </Card>
                    </Panel>

                }

                {/* Switching mode */}
                {

                    <Panel position="top-left" className="select-none">
                        <div className="flex items-center space-x-3">
                            <Switch className="cursor-pointer" size="xl" id="airplane-mode" checked={isEditMode} onCheckedChange={setIsEditMode}/>
                            <Label className="cursor-pointer text-sm" htmlFor="airplane-mode"> { isEditMode ? '編集モード' : '準備モード' } </Label>
                        </div>
                    </Panel>

                }

            </ReactFlow>
        </div>
    );
}

export default FlowClient;
