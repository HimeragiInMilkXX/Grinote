import { describe, expect, it } from "vitest";
import { isoWeekday, isWorkDay, normalizeWorkDays, sameWorkDays, workDayNames } from "./work-days";

describe( "normalizeWorkDays", () => {

    it( "dedupes, sorts and drops invalid values", () => {
        expect( normalizeWorkDays( [ 5, 1, 5, 0, 8, 3.5, "2", 7 ] ) ).toEqual( [ 1, 5, 7 ] );
    });

    it( "handles null / non-arrays", () => {
        expect( normalizeWorkDays( null ) ).toEqual( [] );
        expect( normalizeWorkDays( undefined ) ).toEqual( [] );
    });

});

describe( "isoWeekday / isWorkDay", () => {

    it( "uses Monday = 1 ... Sunday = 7", () => {
        expect( isoWeekday( new Date( 2026, 10, 23 ) ) ).toBe( 1 ); // Mon 23 Nov 2026
        expect( isoWeekday( new Date( 2026, 10, 22 ) ) ).toBe( 7 ); // Sun 22 Nov 2026
    });

    it( "checks membership", () => {
        expect( isWorkDay( [ 1, 3 ], new Date( 2026, 10, 23 ) ) ).toBe( true );
        expect( isWorkDay( [ 1, 3 ], new Date( 2026, 10, 22 ) ) ).toBe( false );
        expect( isWorkDay( null, new Date( 2026, 10, 22 ) ) ).toBe( false );
    });

});

describe( "workDayNames / sameWorkDays", () => {

    it( "returns names in week order", () => {
        expect( workDayNames( [ 7, 1, 3 ] ) ).toEqual( [ "Monday", "Wednesday", "Sunday" ] );
        expect( workDayNames( [ 6, 7 ], "ja" ) ).toEqual( [ "土", "日" ] );
    });

    it( "compares ignoring order and duplicates", () => {
        expect( sameWorkDays( [ 3, 1 ], [ 1, 3, 3 ] ) ).toBe( true );
        expect( sameWorkDays( [ 1 ], [ 1, 2 ] ) ).toBe( false );
    });

});
