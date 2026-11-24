import { describe, expect, it } from "vitest";
import { buildLevelCurve, getGrowthStage, getLevelState, planXpGain, totalXpAtLevel, xpToNextLevel } from "./level";

const GS = { 1: 50, 5: 100, 10: 150, 25: 200, 45: 400, 50: 500 };
const raw = buildLevelCurve( GS, 1 );
const scaled = buildLevelCurve( GS, 5 );

describe( "level curve", () => {

    it( "uses the step for the current level", () => {
        expect( xpToNextLevel( 1, raw ) ).toBe( 50 );
        expect( xpToNextLevel( 4, raw ) ).toBe( 50 );
        expect( xpToNextLevel( 5, raw ) ).toBe( 100 );
        expect( xpToNextLevel( 99, raw ) ).toBe( 500 );
    });

    it( "scales requirements", () => {
        expect( xpToNextLevel( 1, scaled ) ).toBe( 250 );
        expect( totalXpAtLevel( 10, raw ) ).toBe( 700 );
        expect( totalXpAtLevel( 10, scaled ) ).toBe( 3500 );
    });

    it( "keeps levels when XP is rescaled with the curve", () => {
        // the migration multiplied existing XP by the scale
        for( const xp of [ 0, 30, 60, 115, 705 ] )
            expect( getLevelState( xp * 5, scaled ).level ).toBe( getLevelState( xp, raw ).level );
    });

    it( "falls back to the default curve for empty growth_step", () => {
        expect( xpToNextLevel( 1, buildLevelCurve( {}, 1 ) ) ).toBe( 50 );
    });

});

describe( "getLevelState", () => {

    it( "handles level boundaries", () => {
        expect( getLevelState( 0, raw ) ).toMatchObject( { level: 1, xpIntoLevel: 0, xpForNextLevel: 50, progress: 0 } );
        expect( getLevelState( 49, raw ).level ).toBe( 1 );
        expect( getLevelState( 50, raw ) ).toMatchObject( { level: 2, xpIntoLevel: 0 } );
        expect( getLevelState( 705, raw ) ).toMatchObject( { level: 10, xpIntoLevel: 5, xpForNextLevel: 150 } );
        expect( getLevelState( -10, raw ).level ).toBe( 1 );
    });

});

describe( "getGrowthStage", () => {

    it( "maps growth_step keys to stages 0..5", () => {
        expect( getGrowthStage( 1, GS ) ).toEqual( { stage: 0, maxStage: 5, stageLevel: 1, nextStageLevel: 5 } );
        expect( getGrowthStage( 4, GS ).stage ).toBe( 0 );
        expect( getGrowthStage( 5, GS ).stage ).toBe( 1 );
        expect( getGrowthStage( 30, GS ) ).toMatchObject( { stage: 3, stageLevel: 25 } );
        expect( getGrowthStage( 80, GS ) ).toEqual( { stage: 5, maxStage: 5, stageLevel: 50, nextStageLevel: null } );
    });

});

describe( "planXpGain", () => {

    it( "stays in one level", () => {
        const plan = planXpGain( 0, 25, raw );
        expect( plan.levelsGained ).toBe( 0 );
        expect( plan.segments ).toEqual( [ { level: 1, from: 0, to: 0.5, levelUp: false } ] );
    });

    it( "splits a multi-level gain into segments", () => {
        const plan = planXpGain( 25, 100, raw ); // 125 total = Lv3 + 25
        expect( plan.after ).toMatchObject( { level: 3, xpIntoLevel: 25 } );
        expect( plan.segments ).toEqual( [
            { level: 1, from: 0.5, to: 1, levelUp: true },
            { level: 2, from: 0, to: 1, levelUp: true },
            { level: 3, from: 0, to: 0.5, levelUp: false },
        ] );
    });

    it( "lands exactly on a level boundary", () => {
        const plan = planXpGain( 0, 50, raw );
        expect( plan.segments ).toEqual( [
            { level: 1, from: 0, to: 1, levelUp: true },
            { level: 2, from: 0, to: 0, levelUp: false },
        ] );
    });

});
