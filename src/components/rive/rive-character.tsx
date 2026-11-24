"use client"

import { Rive, useRive, useStateMachineInput } from "@rive-app/react-canvas";
import { useAtom } from "jotai";
import { RefObject, useEffect, useImperativeHandle } from "react";
import { lvAtom } from "../project/character/character-xp-bar";
import { DEFAULT_GROWTH_STEP, getGrowthStage } from "@/lib/character/level";

interface RiveCharacterProps extends React.HTMLAttributes<HTMLDivElement> {

    ref: RefObject<RiveCharacterHandle | null>
    className?: string;
    character_id: number;
    onRiveReady?: () => void;
    growth_step: Record<number, number> | undefined;

}

export interface RiveCharacterHandle {

    setHandsUp: ( value: boolean ) => void;
    setSpeaking: ( value: boolean ) => void;
    fireSuccess: () => void;
    fireFail: () => void;

}

const STATE_MACHINE = "State Machine 1"

// Suppress deprecation warnings from state machine of Rive
Rive.suppressDeprecationWarnings = ["state-machine-inputs"]

const RiveCharacter = ( { growth_step = DEFAULT_GROWTH_STEP, ref, character_id, className = "", onRiveReady = () => {}, ...eventProps }: RiveCharacterProps ) => {

    const [ level, _ ] = useAtom(lvAtom)

    // SHOW RIV FILE OF THE CURRENT GROWTH STAGE
    const step = getGrowthStage( level, growth_step ).stageLevel;

    const { rive, RiveComponent } = useRive({
        src: `/character/rive/${character_id}/${step}.riv`,
        stateMachine: STATE_MACHINE,
        autoplay: true,
    })

    const speaking = useStateMachineInput( rive, STATE_MACHINE, "Speaking", false )

    const handsUp = useStateMachineInput( rive, STATE_MACHINE, "hands_up", false );

    const success = useStateMachineInput( rive, STATE_MACHINE, "success" );

    const fail = useStateMachineInput( rive, STATE_MACHINE, "fail" );

    useImperativeHandle( ref, () => {

        return {

            setHandsUp: ( value: boolean ) => { handsUp!.value = value },
            setSpeaking: ( value: boolean ) => { speaking!.value = value },
            fireSuccess: () => { success?.fire() },
            fireFail: () => { fail?.fire() }

        }

    }, [handsUp, speaking, success, fail])

    useEffect( () => { if( rive && handsUp && speaking && success && fail ) onRiveReady() },
        [ rive, handsUp, speaking, success, fail ] )

    return (

        <div className={`${className} aspect-square`} {...eventProps}>

            <RiveComponent/>

        </div>

    )

}

export default RiveCharacter