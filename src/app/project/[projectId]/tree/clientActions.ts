"use client";

import { TaskNodeType } from "@/types/flow";
import dagre from "@dagrejs/dagre";
import { Edge, Node } from "@xyflow/react";

const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel( () => ({}) );

const nodeWidth = 172;
const nodeHeight = 36;

export const getLayoutedElements = ( nodes: TaskNodeType[], edges: Edge[] ) => {

    dagreGraph.setGraph( { rankdir: 'LR' } );

    nodes.forEach( node => dagreGraph.setNode( node.id, { width: nodeWidth, height: nodeHeight } ) );

    edges.forEach( edge => dagreGraph.setEdge( edge.source, edge.target ) );

    dagre.layout( dagreGraph );

    const newNodes = nodes.map( node => {

        const nodeWithPosition = dagreGraph.node( node.id );

        const newNode = {

            ...node,
            targetPosition: 'left',
            sourcePosition: 'right',
            position: {

                x: nodeWithPosition.x - nodeWidth / 2,
                y: nodeWithPosition.y - nodeHeight / 2

            }

        }

        return newNode

    })

    return { nodes: newNodes, edges };

}