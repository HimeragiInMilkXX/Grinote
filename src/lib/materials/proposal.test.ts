import { describe, expect, it } from "vitest";
import { normalizeMaterialOps, type MaterialProposalContext } from "./proposal";

const ctx = (): MaterialProposalContext => ( {
    materialIds: new Set( [ 1, 2 ] ),
    nodeIds: new Set( [ "n1", "n2" ] ),
    links: new Set( [ "1:n1" ] ),
    existingUrls: new Set( [ "https://existing.example.com/" ] ),
} );

describe( "normalizeMaterialOps", () => {

    it( "accepts a valid proposal", () => {
        const { ops, warnings } = normalizeMaterialOps( {
            create_external: [ { name: " Docs ", url: "https://docs.example.com", node_ids: [ "n1", "n1" ] } ],
            link: [ { material_id: 2, node_id: "n1" } ],
            unlink: [ { material_id: 1, node_id: "n1" } ],
            suggestions: [ { title: "Find a tutorial", reason: "basics", node_ids: [ "n2" ] } ],
        }, ctx() );
        expect( warnings ).toEqual( [] );
        expect( ops.create_external ).toEqual( [ { name: "Docs", url: "https://docs.example.com/", description: undefined, label: undefined, node_ids: [ "n1" ] } ] );
        expect( ops.link ).toEqual( [ { material_id: 2, node_id: "n1" } ] );
        expect( ops.unlink ).toEqual( [ { material_id: 1, node_id: "n1" } ] );
        expect( ops.suggestions ).toHaveLength( 1 );
    } );

    it( "throws on unknown ids and bad urls", () => {
        expect( () => normalizeMaterialOps( { link: [ { material_id: 9, node_id: "n1" } ] }, ctx() ) ).toThrow( /material_id 9/ );
        expect( () => normalizeMaterialOps( { link: [ { material_id: 1, node_id: "zz" } ] }, ctx() ) ).toThrow( /node_id "zz"/ );
        expect( () => normalizeMaterialOps( { create_external: [ { name: "x", url: "javascript:alert(1)", node_ids: [] } ] }, ctx() ) ).toThrow( /http/ );
        expect( () => normalizeMaterialOps( { create_external: [ { name: "x", url: "not a url", node_ids: [] } ] }, ctx() ) ).toThrow( /http/ );
    } );

    it( "drops no-ops with warnings", () => {
        const { ops, warnings } = normalizeMaterialOps( {
            link: [ { material_id: 1, node_id: "n1" }, { material_id: 2, node_id: "n2" }, { material_id: 2, node_id: "n2" } ],
            unlink: [ { material_id: 2, node_id: "n1" } ],
            create_external: [ { name: "dup", url: "https://existing.example.com", node_ids: [] } ],
        }, ctx() );
        expect( ops.link ).toEqual( [ { material_id: 2, node_id: "n2" } ] );
        expect( ops.unlink ).toEqual( [] );
        expect( ops.create_external ).toEqual( [] );
        expect( warnings ).toHaveLength( 3 );
    } );

    it( "rejects linking to the root node", () => {
        const c = { ...ctx(), rootIds: new Set( [ "n2" ] ) };
        expect( () => normalizeMaterialOps( { link: [ { material_id: 2, node_id: "n2" } ] }, c ) ).toThrow( /root goal/ );
        expect( () => normalizeMaterialOps( { create_external: [ { name: "x", url: "https://a.example.com", node_ids: [ "n2" ] } ] }, c ) ).toThrow( /root goal/ );
        // unlinking an old root link is still allowed
        c.links.add( "2:n2" );
        expect( normalizeMaterialOps( { unlink: [ { material_id: 2, node_id: "n2" } ] }, c ).ops.unlink ).toHaveLength( 1 );
    } );

    it( "throws when nothing is left", () => {
        expect( () => normalizeMaterialOps( {}, ctx() ) ).toThrow( /Empty proposal/ );
        expect( () => normalizeMaterialOps( { link: [ { material_id: 1, node_id: "n1" } ] }, ctx() ) ).toThrow( /Nothing left/ );
    } );

} );
