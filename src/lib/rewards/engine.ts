import { REWARD_CONFIG, REWARD_FORMULA_VERSION, type RewardConfig } from "./config";

/** Inputs of the task XP formula (spec section 2). Times share one unit (minutes in the app). */
export interface RewardInput {
    /** Planned time. 0 = no estimate, so no time bonus. */
    estimatedTime: number;
    /** Tracked time. 0 = no valid tracked time, so no time bonus. */
    actualTime: number;
    /** Qualifying consecutive project days (nonnegative integer). */
    projectStreak: number;
    /** Qualifying consecutive completed tasks today (nonnegative integer). */
    taskStreak: number;
    /** 0..aiScoreMax, or null when there is no AI review (factor 1). */
    aiScore: number | null;
    /** Character growth stage BEFORE this task's XP is added. */
    growthStage: number;
    /** Highest growth stage (positive). */
    maxStage: number;
}

export interface RewardFactors {
    timeFactor: number;
    projectStreakFactor: number;
    taskStreakFactor: number;
    aiFactor: number;
    characterFactor: number;
}

export interface RewardResult {
    formulaVersion: string;
    rawXp: number;
    awardedXp: number;
    factors: RewardFactors;
}

export class RewardInputError extends Error {}

const clamp = ( x: number, min: number, max: number ) => Math.min( Math.max( x, min ), max );

/** Throws RewardInputError on invalid input; never silently divides by zero. */
export function validateRewardInput( input: RewardInput ) {

    for( const [ name, value ] of Object.entries( input ) ) {

        if( name === "aiScore" && value === null ) continue;

        if( typeof value !== "number" || !Number.isFinite( value ) )
            throw new RewardInputError( `${name} must be a finite number` );

    }

    if( input.estimatedTime < 0 || input.actualTime < 0 )
        throw new RewardInputError( "Time values must not be negative" );

    if( input.maxStage <= 0 ) throw new RewardInputError( "maxStage must be positive" );

    if( input.projectStreak < 0 || input.taskStreak < 0 ||
        !Number.isInteger( input.projectStreak ) || !Number.isInteger( input.taskStreak ) )
        throw new RewardInputError( "Streak counts must be nonnegative integers" );

}

/** Grinote Reward Engine v1.0 task XP formula. Rounds once, at the very end. */
export function calculateTaskReward( input: RewardInput, config: RewardConfig = REWARD_CONFIG ): RewardResult {

    validateRewardInput( input );

    const c = config;

    const timeFactor = input.estimatedTime > 0 && input.actualTime > 0
        ? 1 + c.timeBonusWeight * Math.min( input.estimatedTime / input.actualTime, c.timeRatioCap )
        : 1;

    const projectStreakFactor = 1 + c.projectStreakMaxBonus *
        clamp( input.projectStreak, 0, c.projectStreakDaysForMaxBonus ) / c.projectStreakDaysForMaxBonus;

    const taskStreakFactor = 1 + c.taskStreakMaxBonus *
        clamp( input.taskStreak, 0, c.taskStreakTasksForMaxBonus ) / c.taskStreakTasksForMaxBonus;

    const aiFactor = 1 + c.aiScoreMaxBonus *
        clamp( input.aiScore ?? 0, 0, c.aiScoreMax ) / c.aiScoreMax;

    const characterFactor = 1 + c.growthStageMaxBonus *
        clamp( input.growthStage, 0, input.maxStage ) / input.maxStage;

    const rawXp = c.baseXp * timeFactor * projectStreakFactor * taskStreakFactor * aiFactor * characterFactor;

    return {
        formulaVersion: REWARD_FORMULA_VERSION,
        rawXp,
        awardedXp: Math.max( 0, Math.round( rawXp ) ),
        factors: { timeFactor, projectStreakFactor, taskStreakFactor, aiFactor, characterFactor },
    };

}
