"use client";

import { TaskNodeType } from "@/types/flow";
import dagre from "@dagrejs/dagre";
import { Edge, Position } from "@xyflow/react";

const nodeWidth = 172;
const nodeHeight = 36;

export const getLayoutedElements = ( nodes: TaskNodeType[], edges: Edge[] ): { nodes: TaskNodeType[], edges: Edge[] } => {

    // A fresh graph per call, so nodes removed since the last layout don't linger
    const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel( () => ({}) );

    dagreGraph.setGraph( { rankdir: 'LR' } );

    nodes.forEach( node => dagreGraph.setNode( node.id, { width: nodeWidth, height: nodeHeight } ) );

    edges.forEach( edge => dagreGraph.setEdge( edge.source, edge.target ) );

    dagre.layout( dagreGraph );

    const newNodes = nodes.map( node => {

        const nodeWithPosition = dagreGraph.node( node.id );

        return {

            ...node,
            targetPosition: Position.Left,
            sourcePosition: Position.Right,
            position: {

                x: nodeWithPosition.x - nodeWidth / 2,
                y: nodeWithPosition.y - nodeHeight / 2

            }

        }

    })

    return { nodes: newNodes, edges };

}
