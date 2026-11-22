"use client"

import { useEffect, useRef, useState } from "react";
import { ReactFlow, addEdge, Node, Edge, Connection, OnConnect, applyNodeChanges, applyEdgeChanges, Background, useReactFlow, ConnectionLineType, getOutgoers, EdgeMouseHandler, Panel, OnConnectStartParams, NodeMouseHandler, ReactFlowJsonObject, ReactFlowInstance, useNodesInitialized, NodeChange, EdgeChange, OnConnectEnd, IsValidConnection } from "@xyflow/react";
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
import { getLayoutedElements } from "@/app/project/[projectId]/tree/clientActions";
import { toast } from "sonner";
import FlowProcessLoading from "@/components/flow/flow-process-loading";
import { atom, useAtom, useSetAtom } from "jotai";
import { treeRequiresSaveActionAtom } from "@/atoms/tree_requires_save_action_atom";
import { isLoadingAtom } from "../miscellaneous/loading-overlay";
import { useTutorialStep } from "@/hooks/useTutorialStep";
import { graphEditRequestAtom } from "@/atoms/graph_edit_request_atom";
import RequestedUpdateConfirmationPanel from "./generated/requested-update-confirmation-dialog";
import { applyTreeChanges, rekeyAddOps, type TreeChangeOps } from "@/lib/tree/tree-changes";
import { applyIdMap, newNodeId, remapNodeIds, type IdMap } from "@/lib/tree/ids";
import type { GraphEditRequest } from "@/atoms/graph_edit_request_atom";

const nodeTypes = {
    taskNode: TaskNode
}

type Elements = { nodes: TaskNodeType[], edges: Edge[] }

type ClientPoint = { clientX: number, clientY: number }

interface FlowClientProps {

    hasActiveTask: boolean;
    initialNodes: TaskNodeType[];
    initialEdges: Edge[];
    project_id: string;
    saveGraphToNodes: ( rawData: ReactFlowJsonObject<TaskNodeType, Edge>, project_id: string ) => Promise<{ idMap: IdMap }>;
    isInitialEditMode?: boolean

}

export const hasActiveTaskAtom = atom(false);

/**
 * Accepted AI drafts were built against the saved tree; give their new nodes fresh ids if any
 * collide with the current canvas. Cached per request so the preview and the confirmed result
 * use the same ids.
 */
const rekeyedOpsCache = new WeakMap<GraphEditRequest, TreeChangeOps>();

const opsForCanvas = ( request: GraphEditRequest, canvasIds: Set<string> ): TreeChangeOps => {
    const cached = rekeyedOpsCache.get( request );
    if( cached && !cached.add.some( a => canvasIds.has( a.key ) ) ) return cached;
    const ops = rekeyAddOps( request.ops, canvasIds );
    rekeyedOpsCache.set( request, ops );
    return ops;
}

const createTaskNode = ( position: { x: number, y: number }, isLoop: boolean, isAction: boolean, takenIds: Set<string> ): TaskNodeType => {

    const name = isAction ? ( isLoop ? '繰り返し行動' : '行動' ) : "レーベル";

    return {

        id: newNodeId( takenIds ),
        position,
        data: { label: name, task: {

            task_name: name,
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

}

/** Floating panel that can be dragged by its header (the child must call `onPointerDown` from the header). */
const DraggablePanel = ( { children }: { children: ( onPointerDown: ( e: React.PointerEvent ) => void ) => React.ReactNode } ) => {

    const dragControls = useDragControls();

    return (
        <motion.div
            drag
            dragControls={dragControls}
            dragListener={false}
            dragMomentum={false}
            className="nodrag">
            { children( e => dragControls.start(e) ) }
        </motion.div>
    )

}

/** Card shown in the bottom-center of the canvas. */
const FlowNotice = ( { children }: { children: React.ReactNode } ) => (
    <Panel position='bottom-center'>
        <Card>
            <CardContent className='flex flex-col gap-3'>
                {children}
            </CardContent>
        </Card>
    </Panel>
)

function FlowClient( { hasActiveTask, initialNodes, initialEdges, saveGraphToNodes, project_id, isInitialEditMode = true }: FlowClientProps ) {

    // For onboarding
    const advanceTutorial = useTutorialStep( project_id );

    const nodesInitialized = useNodesInitialized();

    // Toggle edit/pick mode
    const [ isEditMode, setIsEditMode ] = useState(isInitialEditMode);

    useEffect( () => setIsEditMode(isInitialEditMode), [isInitialEditMode])

    // Determine whether nodes are interactable
    const setHasActiveTaskAtom = useSetAtom(hasActiveTaskAtom)
    useEffect( () => setHasActiveTaskAtom( hasActiveTask ), [hasActiveTask, setHasActiveTaskAtom]);

    const canEdit = !hasActiveTask && isEditMode;

    // Helper functions for the graph
    const { screenToFlowPosition } = useReactFlow();


    // Ref of the ReactFlow Div Element
    const reactFlowRef = useRef<HTMLDivElement | null>(null);

    // Re-focus to the ReactFlow Div Element
    const refocusToClient = () => reactFlowRef.current?.focus();


    // elements.nodes and elements.edges are the only truth source of what's on the graph
    const [elements, setElements, { undo, canUndo, redo, canRedo }] = useUndoable<Elements>(
        { nodes: initialNodes, edges: initialEdges },
        { behavior: "destroyFuture" },
    );

    // Force Save: Route
    const [ requiresSaveAction, setRequiresSaveAction ] = useState<boolean>(false);
    const setSaveCheckAtom = useSetAtom( treeRequiresSaveActionAtom );

    useEffect( () => {

        setSaveCheckAtom({

            projectId: project_id,
            requiresSave: requiresSaveAction

        })

    }, [ requiresSaveAction, project_id, setSaveCheckAtom ])

    useEffect( () => () => setSaveCheckAtom({ projectId: null, requiresSave: false } ), [setSaveCheckAtom])

    // Force Save: Page
    useEffect(() => {

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (!requiresSaveAction) return;
            e.preventDefault();
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);

    }, [requiresSaveAction]);


    // Context Menu related
    const [ showMenu, setShowMenu ] = useState<boolean>(false)
    const [ showNodeMenu, setShowNodeMenu ] = useState<boolean>(false);
    const [ menuPosition, setMenuPosition ] = useState<{ x: number, y: number }>();
    const [ showEditor, setShowEditor ] = useState<boolean>( false )

    // Close All Menus
    const closeAllMenus = () => {
        setShowMenu(false);
        setShowNodeMenu(false);
        setShowEditor(false);
    }

    // Extra actions on redo/undo
    const handleReverseAction = () => {

        closeAllMenus();
        setRequiresSaveAction(true)
        refocusToClient()

    }

    // Replace nodes or edges; `ignore` skips recording the change in undo/redo history
    const triggerUpdate = <K extends keyof Elements>( key: K, value: Elements[K], ignore = false ) => {
        setElements(
            (e) => ({ ...e, [key]: value }),
            "destroyFuture",
            ignore,
        );
    };

    // Update Node properties (not recorded in history)
    const updateNode = ( node_id: string, options: Partial<TaskNodeType> ) => {

        setElements( current => ({

            ...current,
            nodes: current.nodes.map( node => node_id === node.id ? { ...node, ...options } : node )

        }), "destroyFuture", true )

    }


    // Triggered on edge connect attempt
    const onConnect: OnConnect = (connection) => {

        if( !canEdit ) return;

        const newEdge = { ...connection, type: ConnectionLineType.SmoothStep, animated: true };

        setElements((current) => ({
            ...current,
            edges: addEdge( newEdge, current.edges )
        }));

        setRequiresSaveAction(true)

    };

    // Validate the attempted edge connect(can't feed to itself/create a loop)
    const isValidConnection: IsValidConnection = (connection: Edge | Connection) => {

        // Get the connected target
        const target = elements.nodes.find((node) => node.id === connection.target);

        if( !target ) return false;

        // Reject if it's trying to connect to itself
        if (target.id === connection.source) return false;

        // Get the connection source
        const source = elements.nodes.find( node => node.id === connection.source );

        // A completed task can't initialise a connection
        if( source?.data.task.isCompleted ) return false;

        // Reject if the connected target is already connected by something else
        const targetAlreadyHasParent = elements.edges.some((edge) => edge.target === connection.target);
        if ( targetAlreadyHasParent ) return false;

        // Reject if the connection results a loop
        const hasCycle = (node: Node, visited = new Set<string>()): boolean => {

            if (visited.has(node.id)) return false;

            visited.add(node.id);

            for (const outgoer of getOutgoers(node, elements.nodes, elements.edges)) {
                if (outgoer.id === connection.source) return true;
                if (hasCycle(outgoer, visited)) return true;
            }

            return false;

        };

        return !hasCycle(target);
    };

    // Remove Edge on right-clicking
    const onEdgeContextMenu: EdgeMouseHandler = (e, edge) => {

        e.preventDefault();
        e.stopPropagation();

        if( !canEdit ) return;

        setElements((current) => ({
            ...current,
            edges: current.edges.filter((item) => item.id !== edge.id),
        }), "destroyFuture", false);

        refocusToClient()

        setRequiresSaveAction(true)

    }


    // State of nodes that is currently selected
    const [ selectedNode, setSelectedNode ] = useState<TaskNodeType | null>(null);

    // Drag from handle
    const [ connectingNodeInfo, setConnectingNodeInfo ] = useState<{ node_id: string, handle_id: string } | null>(null);

    const onConnectStart = ( _e: unknown, params: OnConnectStartParams ) => {

        if( !canEdit ) return;

        if( params.handleType === "source" && params.nodeId && params.handleId ) {

            setConnectingNodeInfo({

                node_id: params.nodeId,
                handle_id: params.handleId

            })

        }

    }

    const onConnectEnd: OnConnectEnd = ( e ) => {

        const target = e.target as HTMLElement | null;
        const targetIsPane = target?.classList.contains('react-flow__pane')

        if( targetIsPane && connectingNodeInfo && "clientX" in e ) {

            setMenuPosition({ x: e.clientX, y: e.clientY })
            setShowMenu(true)

        } else {

            setConnectingNodeInfo(null)

        }

    }

    const openMenuAt = ( e: ClientPoint, menu: "pane" | "node" ) => {

        setShowMenu( menu === "pane" )
        setShowNodeMenu( menu === "node" )
        setConnectingNodeInfo(null)

        setMenuPosition({ x: e.clientX ?? 0, y: e.clientY ?? 0 });

    }

    // Triggered on right-clicking blank spaces
    const onContextMenu = ( e: React.MouseEvent ) => {

        e.preventDefault();
        e.stopPropagation();

        if( !canEdit ) return;

        openMenuAt( e, "pane" );

    }

    // Completed and root tasks can't be selected
    const deselectIfLocked = ( node: TaskNodeType ) => {

        if( !node.data.task.isCompleted && !node.data.task.isRoot ) return false;

        setSelectedNode( null );
        updateNode( node.id, { selected: false } );
        return true;

    }

    // Triggered on right-clicking nodes
    const onNodeContextMenu: NodeMouseHandler<TaskNodeType> = ( e, node ) => {

        e.preventDefault();
        e.stopPropagation();

        if( !canEdit ) return;

        if( deselectIfLocked( node ) ) return;

        if( selectedNode ) updateNode( selectedNode.id, { selected: false } );

        setSelectedNode( node );

        updateNode( node.id, { selected: true } );

        openMenuAt( e, "node" );

    }

    // Triggered on left-clicking blank spaces
    const onPaneClick = ( e: React.MouseEvent ) => {

        e.preventDefault();
        e.stopPropagation();

        closeAllMenus()

        if( !canEdit ) return;

        setSelectedNode(null)
        setConnectingNodeInfo(null)

    }


    // React to focus node change
    const onNodeClick: NodeMouseHandler<TaskNodeType> = ( e, node ) => {

        e.stopPropagation();

        if( hasActiveTask ) return;

        setShowMenu(false);
        setShowNodeMenu(false);

        if( deselectIfLocked( node ) ) return;

        setSelectedNode( node )

        setShowEditor( true )

    }


    // React to changes, for example to exclude some changes from undo/redo history
    const onNodesChange = ( changes: NodeChange<TaskNodeType>[] ) => {

        const first = changes[0];
        let ignore = first.type === "dimensions" || first.type === "position";

        if ( first.type === "position" && !first.dragging ) {
            setRequiresSaveAction(true)
            ignore = false;
        }

        triggerUpdate("nodes", applyNodeChanges(changes, elements.nodes), ignore);

    };

    const onEdgesChange = ( changes: EdgeChange<Edge>[] ) => {

        const ignore = changes[0].type === "select";
        triggerUpdate("edges", applyEdgeChanges(changes, elements.edges), ignore);
        setRequiresSaveAction(true)

    };


    // Keyboard shortcut for undo/redo (Ctrl/Cmd + Z / Y)
    const handleKeyPress = ( event: React.KeyboardEvent ) => {

        if( !canEdit ) return;
        if( !( event.ctrlKey || event.metaKey ) ) return;

        const key = event.key.toLowerCase();

        if ( canUndo && key === "z" ) {
            undo();
            handleReverseAction()
        }
        else if ( canRedo && key === "y" ) {
            redo();
            handleReverseAction()
        }

    };


    // Menu Options
    const insertNewTask = ( e: React.MouseEvent, isLoop: boolean = false, isAction: boolean = false ) => {

        if( hasActiveTask ) return;

        // Unfocus previous task
        if( selectedNode ) updateNode( selectedNode.id, { selected: false } );

        const newNode = createTaskNode( screenToFlowPosition({ x: e.clientX, y: e.clientY }), isLoop, isAction, new Set( elements.nodes.map( n => n.id ) ) );

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

        setRequiresSaveAction(true)

        advanceTutorial( 0 );

        refocusToClient()

    };

    const layoutNodes = () => {

        setElements( current => getLayoutedElements( current.nodes, current.edges ) )

        setRequiresSaveAction(true)

        closeAllMenus();

    };


    // SAVE
    const [ rfInstance, setRfInstance ] = useState<ReactFlowInstance<TaskNodeType, Edge>>();

    const [ isSaving, setIsSaving ] = useState(false);

    const setIsLoading = useSetAtom( isLoadingAtom );

    const saveGraph = async () => {

        if( !canEdit || isSaving || !rfInstance ) return;

        try {

            setIsSaving(true)
            setIsLoading(true)

            const { idMap } = await saveGraphToNodes( rfInstance.toObject(), project_id );

            // The server gave some nodes new ids (an id was invalid or already used elsewhere): follow them
            if( Object.keys( idMap ).length > 0 ) {
                setElements( current => applyIdMap( current, idMap ), "destroyFuture", true );
                setSelectedNode( null );
            }

            toast.success("変更は保存されました！", { position: "top-left" });

            closeAllMenus();
            setRequiresSaveAction(false)

            await advanceTutorial( 1 );

        } catch {

            toast.error("保存に失敗しました。もう一度お試しください。", { position: "top-left" });

        } finally {

            setIsSaving( false );
            setIsLoading(false)
            refocusToClient()

        }

    }


    const insertByInput = ( nodes: string | TaskNodeType[], edges: string | Edge[] ) => {

        if( hasActiveTask ) return;

        if( selectedNode ) updateNode( selectedNode.id, { selected: false } );

        let parsedNodes: TaskNodeType[];
        let parsedEdges: Edge[];

        try {
            parsedNodes = typeof nodes === "string" ? JSON.parse(nodes) : nodes;
            parsedEdges = typeof edges === "string" ? ( edges.trim() ? JSON.parse( edges ) : [] ) : edges;
            if( !Array.isArray( parsedNodes ) || !Array.isArray( parsedEdges ) ) throw new Error();
        } catch {
            toast.error("JSONデータを読み取れませんでした。", { position: "top-left" });
            return;
        }

        // Imported data is a copy: every imported node gets a fresh id, so pasting twice or pasting
        // nodes from another project never reuses an id that already exists.
        const currentIds = new Set( elements.nodes.map( n => n.id ) );
        const importedIds = parsedNodes.filter( n => n && typeof n.id === "string" ).map( n => n.id );
        const { graph: imported, idMap } = remapNodeIds( { nodes: parsedNodes.filter( n => n && typeof n.id === "string" ), edges: [] }, importedIds, currentIds );

        // Keep imported edges whose ends exist (imported or already on the canvas), one parent per node
        const hasParent = new Set( elements.edges.map( e => e.target ) );
        const newEdges: Edge[] = [];
        parsedEdges.forEach( e => {
            const source = idMap[e?.source] ?? e?.source;
            const target = idMap[e?.target] ?? e?.target;
            const known = ( id: string ) => currentIds.has( id ) || imported.nodes.some( n => n.id === id );
            if( !source || !target || source === target || !known( source ) || !known( target ) || hasParent.has( target ) ) return;
            hasParent.add( target );
            newEdges.push({ ...e, id: `${source}-${target}`, source, target });
        });

        closeAllMenus()
        setSelectedNode(null)

        setElements( current => ({

            nodes: [ ...current.nodes, ...imported.nodes ],
            edges: [ ...newEdges, ...current.edges ]

        }), "destroyFuture")

        layoutNodes();

        advanceTutorial( 0 );

    }

    // Node Menu Options
    const startViewing = () => {

        setShowEditor(true);
        setShowNodeMenu( false );

    }

    const deleteNode = () => {

        if( hasActiveTask || !selectedNode ) return;

        setElements( current => ({

            ...current,
            nodes: current.nodes.filter( node => node.id !== selectedNode.id),
            edges: current.edges.filter( edge => ( edge.source !== selectedNode.id ) && ( edge.target !== selectedNode.id ) )

        }), "destroyFuture", false)

        setSelectedNode( null );
        closeAllMenus();

        setRequiresSaveAction( true );

        refocusToClient()

    }

    const duplicateNode = ( e: React.MouseEvent ) => {

        if( hasActiveTask || !selectedNode ) return;

        updateNode( selectedNode.id, { selected: false } );

        const newNode: TaskNodeType = {

            id: newNodeId( new Set( elements.nodes.map( n => n.id ) ) ),
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

    }


    // Trigger on switch mode
    useEffect( () => {

        // Reject switching if not yet saved
        if( !isEditMode && requiresSaveAction ) {
            alert("編集内容をまず保存してください")
            setIsEditMode( true );
        }

        closeAllMenus();
        refocusToClient();

    // Only react to the mode switch itself
    }, [isEditMode])


    // Pending ai generated changes
    const [ graphEditRequest, setGraphEditRequest ] = useAtom(graphEditRequestAtom);

    // Re-apply the accepted proposal to the CURRENT canvas, which may be newer than the draft
    const editRequestForProject = graphEditRequest?.project_id === project_id ? graphEditRequest : null;

    const getEditResult = () => editRequestForProject
        ? applyTreeChanges(
            elements,
            opsForCanvas( editRequestForProject, new Set( elements.nodes.map( n => n.id ) ) ),
            { allowedProtectedIds: editRequestForProject.allowedProtectedIds },
        )
        : null;

    const confirmEditRequest = () => {

        const result = getEditResult();

        if( !result || result.errors.length > 0 ) return;

        if( selectedNode ) updateNode( selectedNode.id, { selected: false } );
        closeAllMenus();
        setSelectedNode( null );

        // One undoable step: apply the changes and lay out the merged tree
        setElements( () => getLayoutedElements( result.graph.nodes, result.graph.edges ), "destroyFuture", false );
        setGraphEditRequest( null );

        // Accepted proposals are only persisted once the tree is saved
        setRequiresSaveAction( true );

        advanceTutorial( 0 );

        refocusToClient();

    }

    return (
        <div className='w-full h-screen'>

            { (!nodesInitialized && elements.nodes.length !== 0) && <FlowProcessLoading/> }

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

                onKeyDown={handleKeyPress}

                onConnectStart={onConnectStart}
                onConnectEnd={onConnectEnd}

                nodesConnectable={isEditMode}
                nodesDraggable={isEditMode}

                tabIndex={0}
                fitView

            >

                <Background />

                {/* Menu */}
                { (menuPosition && isEditMode) &&  <>

                    { showMenu && <FlowContextMenu x={menuPosition.x} y={menuPosition.y} insertNewTask={insertNewTask} layoutNodes={layoutNodes} saveGraph={saveGraph} insertByInput={insertByInput}/> }
                    { showNodeMenu && <NodeContextMenu x={menuPosition.x} y={menuPosition.y} startViewing={startViewing} deleteNode={deleteNode} duplicateNode={duplicateNode}/> }

                </>}

                {/* Editor (edit mode) / confirm panel (pick mode) */}
                <Panel position='top-right'>

                    { !hasActiveTask && ( ( showEditor && selectedNode ) ?

                        <DraggablePanel>
                            { onPointerDown => isEditMode
                                ? <NodeDataDisplayEditor selectedNode={selectedNode} onPointerDown={onPointerDown} requiresSaveAction={() => setRequiresSaveAction(true)}/>
                                : <NodeDataConfirmPanel project_id={project_id} selectedNode={selectedNode} onPointerDown={onPointerDown}/> }
                        </DraggablePanel>

                        : <p className='text-2xl'> { isEditMode ? "右クリックから始めましょう！" : "今日はどれにしますか？" } </p>

                    ) }

                </Panel>

                {/* Reminder to save */}
                { requiresSaveAction && (
                    <FlowNotice>
                        <p className='text-xl text-red-600'> 保存されていない変更内容がある </p>
                        <Button onClick={saveGraph}> 今保存する </Button>
                    </FlowNotice>
                ) }

                {/* Reminder of not editable during onair */}
                { hasActiveTask && (
                    <FlowNotice>
                        <p className='text-xl text-red-600 text-center'> 行動中は編集できない </p>
                        { graphEditRequest && <p className='text-xl text-red-600 text-center'> 生成された変更は行動後反映する予定 </p> }
                    </FlowNotice>
                ) }

                {/* if AI-generated content are queued, show */}
                <RequestedUpdateConfirmationPanel

                    isOpen={!!editRequestForProject && canEdit}
                    onConfirm={confirmEditRequest}
                    onDecline={() => setGraphEditRequest( null )}
                    goal={editRequestForProject?.goal}
                    warnings={editRequestForProject?.warnings}
                    getPreview={() => {
                        const result = getEditResult();
                        return result ? { current: elements, result } : null;
                    }}

                />

                {/* Reminder of if there is less than two node */}
                { (elements.nodes.length <= 1 && !isEditMode) && (
                    <FlowNotice>
                        <p className='text-xl'> まだタスクなさそうですね！ </p>
                        <Button onClick={() => setIsEditMode(true)}> まずは作ろう </Button>
                    </FlowNotice>
                ) }

                {/* Switching mode */}
                { !hasActiveTask && (
                    <Panel position="top-left" className="select-none">
                        <div className="flex items-center space-x-3">
                            <Switch className="cursor-pointer" size="xl" id="airplane-mode" checked={isEditMode} onCheckedChange={setIsEditMode}/>
                            <Label className="cursor-pointer text-sm" htmlFor="airplane-mode"> { isEditMode ? '編集モード' : '準備モード' } </Label>
                        </div>
                    </Panel>
                ) }

            </ReactFlow>
        </div>
    );
}

export default FlowClient;
