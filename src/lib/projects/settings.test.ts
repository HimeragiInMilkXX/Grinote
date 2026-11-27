import { describe, expect, it } from "vitest";
import { buildSettingsPatch, describeProjectSettingsError, projectToSettingsInput, type ProjectSettingsSource } from "./settings";

const NOW = new Date( 2026, 10, 22, 12 ); // 2026-11-22

const saved: ProjectSettingsSource = {
    name: "Guitar",
    description: "Learn songs",
    achieve_date_goal: "2026-12-31",
    daily_time_goal: "00:30:00",
    work_days: [ 1, 3, 5 ],
    character_given_name: "Pochi",
    character_name_changed_at: null,
    color: "teal",
};

const input = () => projectToSettingsInput( saved );

describe( "buildSettingsPatch", () => {

    it( "returns an empty patch when nothing changed", () => {
        expect( buildSettingsPatch( saved, input(), NOW ) ).toEqual( { ok: true, patch: {} } );
    });

    it( "returns only changed columns, normalized", () => {
        const res = buildSettingsPatch( saved, {
            ...input(),
            name: "  Guitar 2 ",
            daily_time_goal: { hours: 1, minutes: 0, seconds: 0 },
            work_days: [ 6, 1, 6 ],
        }, NOW );
        expect( res ).toEqual( { ok: true, patch: { name: "Guitar 2", daily_time_goal: "01:00:00", work_days: [ 1, 6 ] } } );
    });

    it( "never includes locked columns", () => {
        const res = buildSettingsPatch( saved, { ...input(), final_goal: "x", character_id: 9, character_xp: 999 }, NOW );
        expect( res ).toEqual( { ok: true, patch: {} } );
    });

    it( "treats work day order as irrelevant", () => {
        expect( buildSettingsPatch( saved, { ...input(), work_days: [ 5, 3, 1 ] }, NOW ) ).toEqual( { ok: true, patch: {} } );
    });

    it( "requires a changed date to be today or later", () => {
        expect( buildSettingsPatch( saved, { ...input(), achieve_date_goal: "2026-11-21" }, NOW ) )
            .toMatchObject( { ok: false, errors: { achieve_date_goal: expect.any( String ) } } );
        expect( buildSettingsPatch( saved, { ...input(), achieve_date_goal: "2026-11-22" }, NOW ) )
            .toEqual( { ok: true, patch: { achieve_date_goal: "2026-11-22" } } );
    });

    it( "keeps an unchanged past date valid", () => {
        const past = { ...saved, achieve_date_goal: "2026-01-01" };
        expect( buildSettingsPatch( past, { ...projectToSettingsInput( past ), name: "New" }, NOW ) )
            .toEqual( { ok: true, patch: { name: "New" } } );
    });

    it( "rejects invalid dates", () => {
        expect( buildSettingsPatch( saved, { ...input(), achieve_date_goal: "2026-02-30" }, NOW ).ok ).toBe( false );
    });

    it( "allows the character rename once", () => {
        expect( buildSettingsPatch( saved, { ...input(), character_given_name: "Tama" }, NOW ) )
            .toEqual( { ok: true, patch: { character_given_name: "Tama" } } );

        const renamed = { ...saved, character_name_changed_at: "2026-11-01T00:00:00Z" };
        expect( buildSettingsPatch( renamed, { ...input(), character_given_name: "Tama" }, NOW ) )
            .toMatchObject( { ok: false, errors: { character_given_name: expect.any( String ) } } );
        // unchanged name is fine after the rename was used
        expect( buildSettingsPatch( renamed, input(), NOW ) ).toEqual( { ok: true, patch: {} } );
    });

    it( "validates field shapes", () => {
        const res = buildSettingsPatch( saved, {
            ...input(),
            name: "  ",
            work_days: [ 9 ],
            daily_time_goal: { hours: 0, minutes: 1, seconds: 0 },
            character_given_name: "x".repeat( 21 ),
        }, NOW );
        expect( res.ok ).toBe( false );
        if( !res.ok ) expect( Object.keys( res.errors ).sort() ).toEqual( [ "character_given_name", "daily_time_goal", "name", "work_days" ] );
    });

    it( "reports row-dependent errors together with shape errors", () => {
        const res = buildSettingsPatch( saved, { ...input(), name: "", achieve_date_goal: "2026-11-01" }, NOW );
        expect( res.ok ).toBe( false );
        if( !res.ok ) expect( Object.keys( res.errors ).sort() ).toEqual( [ "achieve_date_goal", "name" ] );
    });

    it( "patches a changed color and rejects unknown keys", () => {
        expect( buildSettingsPatch( saved, { ...input(), color: "rose" }, NOW ) ).toEqual( { ok: true, patch: { color: "rose" } } );
        const res = buildSettingsPatch( saved, { ...input(), color: "#ff0000" }, NOW );
        expect( res.ok ).toBe( false );
        if( !res.ok ) expect( Object.keys( res.errors ) ).toEqual( [ "color" ] );
    });

    it( "repairs an invalid stored color on save", () => {
        const bad = { ...saved, color: "purple" };
        expect( projectToSettingsInput( bad ).color ).toBe( "teal" );
        expect( buildSettingsPatch( bad, projectToSettingsInput( bad ), NOW ) ).toEqual( { ok: true, patch: { color: "teal" } } );
    });

    it( "writes a daily goal when the saved one is missing", () => {
        const noGoal = { ...saved, daily_time_goal: null };
        expect( buildSettingsPatch( noGoal, { ...input(), daily_time_goal: { hours: 0, minutes: 30, seconds: 0 } }, NOW ) )
            .toEqual( { ok: true, patch: { daily_time_goal: "00:30:00" } } );
    });

});

describe( "describeProjectSettingsError", () => {

    it( "maps trigger keys and falls back to the raw text", () => {
        expect( describeProjectSettingsError( "project_active_task" ) ).toContain( "タスク実行中" );
        expect( describeProjectSettingsError( "boom" ) ).toBe( "boom" );
        expect( describeProjectSettingsError( null ) ).toBe( "設定の保存に失敗しました。" );
    });

});
