'use client'

import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import CharacterPickCarousel, { CharacterPickCarouselHandle } from "./character-pick-carousel"
import { useRef, useState } from "react"
import { handlePickCharacter } from "@/app/project/new/clientActions"

const NewProjectCharacterPanel = ( { characters }: {

    characters: {
        id: any;
        name: any;
        group: any;
        description: any;
    }[] | null,

}) => {

    const pickCarouselRef = useRef<CharacterPickCarouselHandle>(null);

    const [ isSubmitting, setIsSubmitting ] = useState( false );

    const handleSubmit = async () => {

        setIsSubmitting( true );

        try {

            await handlePickCharacter( pickCarouselRef.current?.getPickedCharacterId() ?? 1 )

        } catch( e ) { console.log( e ) }

    }

    return (
        <Card className="w-full sm:max-w-md">

            <CardHeader>
                <CardTitle> 達成するまでの仲間のキャラクター選びましょう！ </CardTitle>
            </CardHeader>

            <CardContent>

                <CharacterPickCarousel characters={characters} ref={pickCarouselRef}/>

            </CardContent>

            <CardFooter>
                <Button className="w-full" disabled={isSubmitting} onClick={handleSubmit}> { isSubmitting ? "送信中..." : "次へ" } </Button>
            </CardFooter>

        </Card>
    )

}

export default NewProjectCharacterPanel
