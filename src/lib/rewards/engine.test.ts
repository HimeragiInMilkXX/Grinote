import { describe, expect, it } from "vitest";
import { calculateTaskReward, RewardInputError, type RewardInput } from "./engine";
import { REWARD_CONFIG } from "./config";
import { intervalToMinutes, msToMinutes } from "./breakdown";

describe( "time inputs", () => {

    it( "parses Postgres intervals to minutes", () => {
        expect( intervalToMinutes( "00:30:00" ) ).toBe( 30 );
        expect( intervalToMinutes( "01:15:30" ) ).toBe( 75.5 );
        expect( intervalToMinutes( "1 day 02:00:00" ) ).toBe( 1560 );
        expect( intervalToMinutes( "00:00:00" ) ).toBe( 0 );
        expect( intervalToMinutes( null ) ).toBe( 0 );
        expect( intervalToMinutes( "garbage" ) ).toBe( 0 );
    });

    it( "converts tracked ms to minutes", () => {
        expect( msToMinutes( 90_000 ) ).toBe( 1.5 );
        expect( msToMinutes( -5 ) ).toBe( 0 );
    });

});

const base: RewardInput = { estimatedTime: 30, actualTime: 30, projectStreak: 0, taskStreak: 0, aiScore: null, growthStage: 0, maxStage: 5 };

describe( "calculateTaskReward: spec acceptance tests", () => {

    const rows: Array<[ string, Partial<RewardInput>, number ]> = [
        [ "normal, no bonuses besides time", {}, 70 ],
        [ "faster (cap reached)", { actualTime: 5 }, 80 ],
        [ "slower", { actualTime: 60 }, 60 ],
        [ "zero tracked time", { actualTime: 0 }, 50 ],
        [ "max all multipliers", { actualTime: 5, projectStreak: 7, taskStreak: 3, aiScore: 100, growthStage: 5 }, 159 ],
        [ "max caps still apply above threshold", { actualTime: 1, projectStreak: 20, taskStreak: 10, aiScore: 500, growthStage: 8 }, 159 ],
        [ "missing AI has no AI bonus", { aiScore: null }, 70 ],
    ];

    it.each( rows )( "%s", ( _name, patch, expected ) => {
        expect( calculateTaskReward( { ...base, ...patch } ).awardedXp ).toBe( expected );
    });

});

describe( "calculateTaskReward: factors", () => {

    it( "reports each factor and the unrounded XP", () => {
        const res = calculateTaskReward( { ...base, actualTime: 5, projectStreak: 7, taskStreak: 3, aiScore: 100, growthStage: 5 } );
        expect( res.formulaVersion ).toBe( "1.0" );
        expect( res.factors.timeFactor ).toBeCloseTo( 1.6 );
        expect( res.factors.projectStreakFactor ).toBeCloseTo( 1.1 );
        expect( res.factors.taskStreakFactor ).toBeCloseTo( 1.05 );
        expect( res.factors.aiFactor ).toBeCloseTo( 1.15 );
        expect( res.factors.characterFactor ).toBeCloseTo( 1.5 );
        expect( res.rawXp ).toBeCloseTo( 159.39 );
    });

    it( "no estimate means no time bonus", () => {
        expect( calculateTaskReward( { ...base, estimatedTime: 0 } ).factors.timeFactor ).toBe( 1 );
    });

    it( "aiScore 0 and null both give an AI factor of 1", () => {
        expect( calculateTaskReward( { ...base, aiScore: 0 } ).factors.aiFactor ).toBe( 1 );
        expect( calculateTaskReward( { ...base, aiScore: null } ).factors.aiFactor ).toBe( 1 );
    });

    it( "uses a custom config", () => {
        expect( calculateTaskReward( { ...base, actualTime: 0 }, { ...REWARD_CONFIG, baseXp: 100 } ).awardedXp ).toBe( 100 );
    });

});

describe( "calculateTaskReward: validation", () => {

    it.each( [
        [ "NaN", { actualTime: NaN } ],
        [ "Infinity", { estimatedTime: Infinity } ],
        [ "negative time", { actualTime: -1 } ],
        [ "maxStage 0", { maxStage: 0 } ],
        [ "negative streak", { projectStreak: -1 } ],
        [ "fractional streak", { taskStreak: 1.5 } ],
        [ "NaN AI score", { aiScore: NaN } ],
    ] as Array<[ string, Partial<RewardInput> ]> )( "rejects %s", ( _name, patch ) => {
        expect( () => calculateTaskReward( { ...base, ...patch } ) ).toThrow( RewardInputError );
    });

});
