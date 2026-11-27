import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isProjectColor, pickDefaultColor, PROJECT_COLOR_KEYS, PROJECT_COLORS, projectColorStyle } from "./colors";

describe( "project colors", () => {

    it( "has one style per key, in key order", () => {
        expect( PROJECT_COLORS.map( c => c.key ) ).toEqual( [ ...PROJECT_COLOR_KEYS ] );
    });

    it( "matches the keys allowed by the DB check constraint", () => {
        const sql = readFileSync( join( process.cwd(), "supabase/migrations/20261127000001_project_color.sql" ), "utf8" );
        const check = sql.match( /check \(color in \(([^)]*)\)\)/ )?.[1] ?? "";
        const keys = [ ...check.matchAll( /'([a-z]+)'/g ) ].map( m => m[1] );
        expect( keys ).toEqual( [ ...PROJECT_COLOR_KEYS ] );
    });

    it( "validates keys", () => {
        expect( isProjectColor( "teal" ) ).toBe( true );
        expect( isProjectColor( "#ff0000" ) ).toBe( false );
        expect( isProjectColor( null ) ).toBe( false );
    });

    it( "falls back to the first color for unknown values", () => {
        expect( projectColorStyle( "nope" ).key ).toBe( "teal" );
        expect( projectColorStyle( null ).key ).toBe( "teal" );
        expect( projectColorStyle( "rose" ).key ).toBe( "rose" );
    });

    it( "picks the first unused color", () => {
        expect( pickDefaultColor( [] ) ).toBe( "teal" );
        expect( pickDefaultColor( [ "teal", "violet" ] ) ).toBe( "amber" );
    });

    it( "cycles once every color is used", () => {
        expect( pickDefaultColor( [ ...PROJECT_COLOR_KEYS ] ) ).toBe( "teal" );
        expect( pickDefaultColor( [ ...PROJECT_COLOR_KEYS, "teal" ] ) ).toBe( "amber" );
    });

});
