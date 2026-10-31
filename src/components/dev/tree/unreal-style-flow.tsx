"use client"

import React, { useState, useCallback } from 'react';
import { 
  ReactFlow, 
  useNodesState, 
  useEdgesState, 
  addEdge, 
  useReactFlow,
  Node,
  Edge,
  Connection,
  OnConnectStartParams
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// Initial pre-populated nodes to play with
const initialNodes: Node[] = [
  {
    id: 'node_1',
    type: 'default',
    position: { x: 100, y: 200 },
    data: { label: 'Start Node' },
  },
  {
    id: 'node_2',
    type: 'default',
    position: { x: 450, y: 200 },
    data: { label: 'Target Node' },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: 'node_1', target: 'node_2' }
];

export default function UnrealStyleFlowTS() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { screenToFlowPosition } = useReactFlow();

  // State for the Unreal-style popup menu and connection context
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [connectingNodeInfo, setConnectingNodeInfo] = useState<{ nodeId: string; handleId: string | null } | null>(null);

  // 1. Captured when the user starts dragging a handle
  const onConnectStart = useCallback((_event: MouseEvent | TouchEvent, params: OnConnectStartParams) => {
    if (params.nodeId) {
      setConnectingNodeInfo({ 
        nodeId: params.nodeId, 
        handleId: params.handleId ?? null 
      });
    }
  }, []);

  // 2. Captured when the user releases the mouse button
  const onConnectEnd = useCallback((event: MouseEvent | TouchEvent) => {
    const target = event.target as HTMLElement | null;
    const targetIsPane = target?.classList.contains('react-flow__pane');

    // If dropped on empty pane space and we have origin info, open the menu
    if (targetIsPane && connectingNodeInfo) {
      const clientX = 'clientX' in event ? event.clientX : event.touches[0].clientX;
      const clientY = 'clientY' in event ? event.clientY : event.touches[0].clientY;

      setMenuPosition({ x: clientX, y: clientY });
    } else {
      // Clear tracking if connected to another valid handle or dropped elsewhere
      setConnectingNodeInfo(null);
    }
  }, [connectingNodeInfo]);

  // 3. Spawn a new node from the menu and connect it
  const handleSelectNodeType = (nodeType: string) => {
    if (!menuPosition || !connectingNodeInfo) return;

    // Convert mouse screen coordinates to canvas flow coordinates
    const position = screenToFlowPosition({
      x: menuPosition.x,
      y: menuPosition.y,
    });

    const newNodeId = `node_${Date.now()}`;
    const newNode: Node = {
      id: newNodeId,
      type: 'default',
      position,
      data: { label: `${nodeType} Blueprint` },
    };

    // Add node and link it up automatically
    setNodes((nds) => nds.concat(newNode));
    setEdges((eds) => eds.concat({
      id: `e_${connectingNodeInfo.nodeId}-${newNodeId}`,
      source: connectingNodeInfo.nodeId,
      sourceHandle: connectingNodeInfo.handleId,
      target: newNodeId,
    }));

    // Reset states to close the menu
    setMenuPosition(null);
    setConnectingNodeInfo(null);
  };

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge(params, eds));
  }, [setEdges]);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        fitView
      >
        {/* Unreal-Style Context Menu Popup */}
        {menuPosition && (
          <div 
            style={{
              position: 'absolute',
              top: menuPosition.y,
              left: menuPosition.x,
              zIndex: 1000,
              background: '#18181b',
              border: '1px solid #3f3f46',
              color: '#f4f4f5',
              padding: '8px',
              borderRadius: '8px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
              width: '180px',
              fontFamily: 'sans-serif',
              fontSize: '13px'
            }}
          >
            <div style={{ fontSize: '11px', color: '#a1a1aa', padding: '4px 6px', marginBottom: '4px', borderBottom: '1px solid #27272a' }}>
              All Actions for Node
            </div>
            <button 
              onClick={() => handleSelectNodeType('Action')}
              style={menuButtonStyle}
            >
              ⚡ Execute Action
            </button>
            <button 
              onClick={() => handleSelectNodeType('Branch')}
              style={menuButtonStyle}
            >
              🔀 Branch Condition
            </button>
            <button 
              onClick={() => handleSelectNodeType('Print')}
              style={menuButtonStyle}
            >
              💬 Print String
            </button>
          </div>
        )}
      </ReactFlow>
    </div>
  );
}

// Simple styling helper for menu buttons
const menuButtonStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  background: 'transparent',
  border: 'none',
  color: '#f4f4f5',
  padding: '8px 6px',
  borderRadius: '4px',
  cursor: 'pointer',
};