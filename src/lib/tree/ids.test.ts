import { afterEach, describe, expect, it, vi } from "vitest";
import type { Edge } from "@xyflow/react";
import { applyIdMap, isUuid, newNodeId, remapNodeIds, sanitizeGraphIds, uniqueById } from "./ids";

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
const U3 = "33333333-3333-4333-8333-333333333333";

const n = ( id: string ) => ({ id });
const e = ( source: string, target: string, id = `${source}-${target}` ): Edge => ({ id, source, target });

afterEach( () => vi.restoreAllMocks() );

describe( "newNodeId", () => {

    it( "returns a v4 UUID", () => {
        expect( isUuid( newNodeId() ) ).toBe( true );
    });

    it( "retries when the generated id is taken", () => {
        const spy = vi.spyOn( globalThis.crypto, "randomUUID" )
            .mockReturnValueOnce( U1 )
            .mockReturnValueOnce( U2 );
        expect( newNodeId( new Set( [ U1 ] ) ) ).toBe( U2 );
        expect( spy ).toHaveBeenCalledTimes( 2 );
    });

    it( "works without crypto.randomUUID (insecure context)", () => {
        const original = globalThis.crypto.randomUUID;
        Object.defineProperty( globalThis.crypto, "randomUUID", { value: undefined, configurable: true } );
        try {
            const id = newNodeId();
            expect( isUuid( id ) ).toBe( true );
            expect( id[14] ).toBe( "4" );
        } finally {
            Object.defineProperty( globalThis.crypto, "randomUUID", { value: original, configurable: true } );
        }
    });

    it( "throws instead of returning a taken id forever", () => {
        vi.spyOn( globalThis.crypto, "randomUUID" ).mockReturnValue( U1 );
        expect( () => newNodeId( new Set( [ U1 ] ) ) ).toThrow();
    });

});

describe( "remapNodeIds / applyIdMap", () => {

    it( "gives listed nodes fresh ids and rewrites edges", () => {
        const { graph, idMap } = remapNodeIds( { nodes: [ n( U1 ), n( U2 ) ], edges: [ e( U1, U2 ) ] }, [ U2 ], new Set( [ U3 ] ) );
        const fresh = idMap[U2];
        expect( isUuid( fresh ) ).toBe( true );
        expect( [ U1, U2, U3 ] ).not.toContain( fresh );
        expect( graph.nodes.map( x => x.id ) ).toEqual( [ U1, fresh ] );
        expect( graph.edges[0] ).toMatchObject({ id: `${U1}-${fresh}`, source: U1, target: fresh });
    });

    it( "leaves the graph untouched with an empty map", () => {
        const g = { nodes: [ n( U1 ) ], edges: [] };
        expect( applyIdMap( g, {} ) ).toBe( g );
    });

});

describe( "sanitizeGraphIds", () => {

    it( "keeps a valid graph as is", () => {
        const g = { nodes: [ n( U1 ), n( U2 ) ], edges: [ e( U1, U2 ) ] };
        const r = sanitizeGraphIds( g );
        expect( r.idMap ).toEqual( {} );
        expect( r.graph.nodes ).toEqual( g.nodes );
        expect( r.graph.edges ).toEqual( g.edges );
    });

    it( "replaces non-UUID ids and keeps edges connected", () => {
        const r = sanitizeGraphIds( { nodes: [ n( U1 ), n( "1" ) ], edges: [ e( U1, "1" ) ] } );
        const fresh = r.idMap["1"];
        expect( isUuid( fresh ) ).toBe( true );
        expect( r.graph.edges ).toEqual( [ expect.objectContaining({ source: U1, target: fresh, id: `${U1}-${fresh}` }) ] );
    });

    it( "renames later duplicates and taken ids", () => {
        const r = sanitizeGraphIds( { nodes: [ n( U1 ), n( U1 ), n( U2 ) ], edges: [ e( U1, U2 ) ] }, new Set( [ U2 ] ) );
        const ids = r.graph.nodes.map( x => x.id );
        expect( ids[0] ).toBe( U1 );
        expect( new Set( ids ).size ).toBe( 3 );
        expect( ids ).not.toContain( U2 );
        expect( r.graph.edges[0] ).toMatchObject({ source: U1, target: r.idMap[U2] });
    });

    it( "drops dangling edges, self edges, extra parents and duplicate edge ids", () => {
        const r = sanitizeGraphIds( {
            nodes: [ n( U1 ), n( U2 ), n( U3 ) ],
            edges: [ e( U1, U2 ), e( U3, U2 ), e( U1, "missing" ), e( U3, U3 ), e( U1, U3, `${U1}-${U2}` ) ],
        });
        expect( r.droppedEdges ).toBe( 3 );
        expect( r.graph.edges.map( x => [ x.source, x.target ] ) ).toEqual( [ [ U1, U2 ], [ U1, U3 ] ] );
        expect( new Set( r.graph.edges.map( x => x.id ) ).size ).toBe( 2 );
    });

});

describe( "uniqueById", () => {
    it( "keeps the first item per id", () => {
        expect( uniqueById( [ { id: "a", v: 1 }, { id: "a", v: 2 }, { id: "b", v: 3 } ] ) ).toEqual( [ { id: "a", v: 1 }, { id: "b", v: 3 } ] );
    });
});
