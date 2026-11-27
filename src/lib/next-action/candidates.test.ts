import { describe, expect, it } from "vitest";
import { buildCandidates, nodeStates, outlineTree } from "./candidates";
import { fixture, node } from "./test-fixtures";


describe( "nodeStates", () => {

    it( "classifies root, groups, completed, blocked and startable nodes", () => {
        const s = nodeStates( fixture );
        expect( s.get( "root" ) ).toBe( "root" );
        expect( s.get( "a" ) ).toBe( "not_action" );
        expect( s.get( "a1" ) ).toBe( "completed" );
        expect( s.get( "a2" ) ).toBe( "startable" );
        expect( s.get( "b" ) ).toBe( "blocked" );
        expect( s.get( "b1" ) ).toBe( "startable" );
        expect( s.get( "p" ) ).toBe( "startable" );
    } );

    it( "unblocks a parent once every child is completed", () => {
        const s = nodeStates( fixture.map( n => n.id === "b1" ? { ...n, isCompleted: true } : n ) );
        expect( s.get( "b" ) ).toBe( "startable" );
    } );

} );

describe( "buildCandidates", () => {

    it( "lists startable nodes in tree order with short keys", () => {
        const c = buildCandidates( fixture );
        expect( c.map( x => [ x.key, x.id ] ) ).toEqual( [ [ "c1", "a2" ], [ "c2", "b1" ], [ "c3", "p" ] ] );
    } );

    it( "carries path, estimate and loop progress", () => {
        const c = buildCandidates( fixture );
        expect( c[0].path ).toEqual( [ "a" ] );
        expect( c[1].estimateMinutes ).toBe( 75 );
        expect( c[2] ).toMatchObject( { isLoop: true, repetitionsCompleted: 1, repetitionsRequired: 3 } );
    } );

    it( "returns nothing for a finished tree", () => {
        expect( buildCandidates( [ node( "root", null, { isRoot: true, isAction: false } ), node( "x", "root", { isCompleted: true } ) ] ) ).toEqual( [] );
    } );

    it( "survives a parent loop in broken data", () => {
        const rows = [ node( "x", "y" ), node( "y", "x" ) ];
        expect( () => buildCandidates( rows ) ).not.toThrow();
    } );

} );

describe( "outlineTree", () => {

    it( "marks states and candidate keys", () => {
        const text = outlineTree( fixture, buildCandidates( fixture ) );
        expect( text ).toContain( "- Goal [final goal]" );
        expect( text ).toContain( "    - a1 [done]" );
        expect( text ).toContain( "  - b [waiting for its subtasks]" );
        expect( text ).toContain( "  - p [startable c3, repeat 1/3]" );
    } );

} );
