"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Carousel, CarouselApi, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import Image from "next/image";
import { useEffect, useImperativeHandle, useState } from "react";

export interface CharacterPickCarouselHandle {

    getPickedCharacterId: () => number;

}

interface CharacterPickCarouselProps {

    ref?: React.Ref<CharacterPickCarouselHandle>;
    characters: {
        id: any;
        name: any;
        group: any;
        description: any;
    }[] | null

}

const CharacterPickCarousel = ( { ref, characters }: CharacterPickCarouselProps ) => {

    const [ api, setApi ] = useState<CarouselApi>();
    const [ picked, setPicked ] = useState<number>(0);

    useEffect( () => {

        if( !api ) return;

        setPicked(api.selectedScrollSnap() + 1)

        api.on("select", () => {
            setPicked(api.selectedScrollSnap() + 1)
        })

    }, [api] )

    useImperativeHandle( ref, () => ({

        getPickedCharacterId: () => picked

    }))

    return (
        <Carousel className="w-full [*]:select-none" opts={{ loop: true }} setApi={setApi}>
            <CarouselContent>
                {characters?.map((char, index) => (
                    <CarouselItem key={index}>
                        <div className="p-1">
                            <Card className="py-0">
                                <CardContent className={`flex aspect-square items-end justify-end p-6 relative`}>
                                    <Image
                                        src={`/character/thumbnail/${encodeURIComponent(char.name)}.png`}
                                        alt={char.name}
                                        fill
                                        priority
                                        quality={100}
                                        className="object-cover object-top"
                                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                    />

                                    <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0)_0%,rgba(255,255,255,1)_100%)] z-1"></div>

                                    <section className="z-1 flex gap-3 items-end flex-col" >

                                        <h3 className="text-4xl font-bold flex items-end gap-3"> <p className="text-xl font-normal"> {char.group} </p> {char.name} </h3>
                                        <p className="text-xl font-light"> {char.description} </p>

                                    </section>
                                </CardContent>
                            </Card>
                        </div>
                    </CarouselItem>
                ))}
            </CarouselContent>
            <CarouselPrevious className="-left-3"/>
            <CarouselNext className="-right-3"/>
        </Carousel>
    )
}

export default CharacterPickCarousel
