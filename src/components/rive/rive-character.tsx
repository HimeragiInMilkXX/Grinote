"use client"

import { useRive, useStateMachineInput } from "@rive-app/react-canvas";
import { useAtom } from "jotai";
import { RefObject, useEffect, useImperativeHandle, useState } from "react";
import { lvAtom } from "../project/character/character-xp-bar";

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

const RiveCharacter = ( { growth_step = {"1": 50, "5": 100, "10": 150, "25": 200, "45": 400, "50": 500}, ref, character_id, className = "", onRiveReady = () => {}, ...eventProps }: RiveCharacterProps ) => {

    const [ step, setStep ] = useState(1);

    const [ level, _ ] = useAtom(lvAtom)

    // SHOW RIV FILE WITH RESPECT TO CURRENT LEVEL THUS STEP
    useEffect( () => {

        let newStep = 1;

        Object.entries( growth_step ).forEach( ( [ lv, _ ] ) => {

            if( level >= Number(lv) ) newStep = Number(lv);

        })

        setStep( newStep );

    }, [level, growth_step])

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