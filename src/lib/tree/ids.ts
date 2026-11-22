/**
 * Node id helpers shared by the tree editor (client), the AI proposal engine and
 * saveGraphToNodes (server). Pure, no React/Next/Supabase dependency.
 *
 * Random v4 UUIDs practically never collide; what does happen is an id being REUSED
 * (pasted JSON, an id echoed by the model, a draft applied to a newer canvas). These
 * helpers make sure every node id is a UUID, unique, and not already taken.
 */

import type { Edge } from "@xyflow/react";

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isUuid = ( id: unknown ): id is string => typeof id === "string" && UUID_REGEX.test( id );

const formatV4 = ( bytes: Uint8Array ) => {
    bytes[6] = ( bytes[6] & 0x0f ) | 0x40;
    bytes[8] = ( bytes[8] & 0x3f ) | 0x80;
    const hex = Array.from( bytes, b => b.toString( 16 ).padStart( 2, "0" ) ).join( "" );
    return `${hex.slice( 0, 8 )}-${hex.slice( 8, 12 )}-${hex.slice( 12, 16 )}-${hex.slice( 16, 20 )}-${hex.slice( 20 )}`;
};

/** A v4 UUID. `crypto.randomUUID` only exists in secure contexts (https/localhost), `getRandomValues` everywhere. */
const randomUuid = (): string => {
    const c = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
    if( c && typeof c.randomUUID === "function" ) return c.randomUUID();
    const bytes = new Uint8Array( 16 );
    if( c && typeof c.getRandomValues === "function" ) c.getRandomValues( bytes );
    else for( let i = 0; i < 16; i++ ) bytes[i] = Math.floor( Math.random() * 256 );
    return formatV4( bytes );
};

/** A fresh node id that is not in `taken`. */
export function newNodeId( taken?: { has( id: string ): boolean } ): string {
    for( let attempt = 0; attempt < 16; attempt++ ) {
        const id = randomUuid();
        if( !taken?.has( id ) ) return id;
    }
    throw new Error( "Could not generate a unique node id." );
}

type IdGraph<N extends { id: string }> = { nodes: N[], edges: Edge[] };

export type IdMap = Record<string, string>;

const edgeId = ( source: string, target: string ) => `${source}-${target}`;

/** Rewrite node ids and edge endpoints with `idMap`. Remapped edges get a fresh `${source}-${target}` id. */
export function applyIdMap<N extends { id: string }>( graph: IdGraph<N>, idMap: IdMap ): IdGraph<N> {
    if( Object.keys( idMap ).length === 0 ) return graph;
    return {
        nodes: graph.nodes.map( n => idMap[n.id] ? { ...n, id: idMap[n.id] } : n ),
        edges: graph.edges.map( e => {
            if( !idMap[e.source] && !idMap[e.target] ) return e;
            const source = idMap[e.source] ?? e.source;
            const target = idMap[e.target] ?? e.target;
            return { ...e, id: edgeId( source, target ), source, target };
        }),
    };
}

/** Give each listed node a fresh id (never in `taken` or the graph), rewriting edges. */
export function remapNodeIds<N extends { id: string }>( graph: IdGraph<N>, ids: Iterable<string>, taken: Set<string> = new Set() ): { graph: IdGraph<N>, idMap: IdMap } {
    const used = new Set( [ ...taken, ...graph.nodes.map( n => n.id ) ] );
    const idMap: IdMap = {};
    for( const id of ids ) {
        if( idMap[id] ) continue;
        const fresh = newNodeId( used );
        used.add( fresh );
        idMap[id] = fresh;
    }
    return { graph: applyIdMap( graph, idMap ), idMap };
}

/**
 * Make a graph's ids safe to render and save:
 * - every node id is a UUID, unique in the list, and not in `taken` (otherwise it gets a fresh id;
 *   for duplicates the first node keeps its id and later copies are renamed);
 * - edges whose endpoints are missing are dropped, each target keeps one parent edge,
 *   and edge ids are unique.
 * Edges always follow the FIRST node with a given id.
 */
export function sanitizeGraphIds<N extends { id: string }>( graph: IdGraph<N>, taken: Set<string> = new Set() ): { graph: IdGraph<N>, idMap: IdMap, droppedEdges: number } {

    const used = new Set<string>( taken );
    const seen = new Set<string>();
    const idMap: IdMap = {};

    graph.nodes.forEach( n => { if( isUuid( n.id ) && !taken.has( n.id ) ) used.add( n.id ); });

    const nodes = graph.nodes.map( n => {
        const bad = !isUuid( n.id ) || taken.has( n.id );
        const duplicate = seen.has( n.id );
        if( !bad && !duplicate ) { seen.add( n.id ); return n; }
        const fresh = newNodeId( used );
        used.add( fresh );
        // Edges point at the first node with this id
        if( !duplicate ) { idMap[n.id] = fresh; seen.add( n.id ); }
        return { ...n, id: fresh };
    });

    const nodeIds = new Set( nodes.map( n => n.id ) );
    const edgeIds = new Set<string>();
    const targets = new Set<string>();
    const edges: Edge[] = [];
    let droppedEdges = 0;

    graph.edges.forEach( e => {
        const source = idMap[e.source] ?? e.source;
        const target = idMap[e.target] ?? e.target;
        if( !nodeIds.has( source ) || !nodeIds.has( target ) || source === target || targets.has( target ) ) { droppedEdges++; return; }
        let id = ( source !== e.source || target !== e.target ) ? edgeId( source, target ) : e.id;
        if( edgeIds.has( id ) ) id = `${edgeId( source, target )}-${newNodeId( edgeIds )}`;
        edgeIds.add( id );
        targets.add( target );
        edges.push( id === e.id && source === e.source && target === e.target ? e : { ...e, id, source, target } );
    });

    return { graph: { nodes, edges }, idMap, droppedEdges };
}

/** Drop later items whose id was already seen (React Flow needs unique keys). */
export function uniqueById<T extends { id: string }>( items: T[] ): T[] {
    const seen = new Set<string>();
    return items.filter( item => {
        if( seen.has( item.id ) ) return false;
        seen.add( item.id );
        return true;
    });
}
