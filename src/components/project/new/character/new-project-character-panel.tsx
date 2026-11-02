'use client'

import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import CharacterPickCarousel, { CharacterPickCarouselHandle } from "./character-pick-carousel"
import { useRef } from "react"
import { handlePickCharacter } from "@/app/project/new/clientActions"
import { useAtom } from "jotai"
import { isLoadingAtom } from "@/components/miscellaneous/loading-overlay"

const NewProjectCharacterPanel = ( { characters }: {

    characters: {
        id: any;
        name: any;
        group: any;
        description: any;
    }[] | null,

}) => {

    const pickCarouselRef = useRef<CharacterPickCarouselHandle>(null);

    const [ isLoading, setIsLoading ] = useAtom(isLoadingAtom)

    const handleSubmit = async () => {

        setIsLoading( true );

        await handlePickCharacter( pickCarouselRef.current?.getPickedCharacterId() ?? 1 )

    }

    return (
        <Card className="w-full sm:max-w-md">

            <CardHeader>
                <CardTitle> 達成するまでの仲間のキャラクター選びましょう！</CardTitle>
            </CardHeader>

            <CardContent>

                <CharacterPickCarousel characters={characters} ref={pickCarouselRef}/>

            </CardContent>

            <CardFooter>
                <Button className="w-full" disabled={isLoading} onClick={handleSubmit}> { isLoading ? "送信中..." : "次へ" } </Button>
            </CardFooter>

        </Card>
    )

}

export default NewProjectCharacterPanel
