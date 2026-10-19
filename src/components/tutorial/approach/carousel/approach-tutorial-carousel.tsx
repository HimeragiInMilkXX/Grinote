"use client"

import { Carousel, CarouselApi, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { useEffect, useState } from "react";
import CarouselProgress from "./carousel-progress";
import WelcomeItem from "../items/welcome-item";
import FirstStepItem from "../items/first-step-item";
import BreakdownItem from "../items/breakdown-item";
import PickItem from "../items/pick-item";
import RecordItem from "../items/record-item";
import { redirect } from "next/navigation";
import { completeIntroduction } from "@/app/dashboard/serverActions";

export default function ApproachTutorialCarousel( { className = "" }: { className?: string } ) {

    const [ api, setApi ] = useState<CarouselApi>();

    const [ current, setCurrent ] = useState(0);
    const [ count, setCount ] = useState(0)

    useEffect(() => {
        
        if (!api) return
    
        setCount(api.scrollSnapList().length)
        setCurrent(api.selectedScrollSnap())
    
        api.on("select", () => {
            setCurrent(api.selectedScrollSnap())
        })

    }, [api])

    return (

        <div className={className}>
            <Carousel setApi={setApi} opts={{ watchDrag: false }}>
                <CarouselContent>
                    <CarouselItem><WelcomeItem/></CarouselItem>
                    <CarouselItem><FirstStepItem/></CarouselItem>
                    <CarouselItem><BreakdownItem/></CarouselItem>
                    <CarouselItem><PickItem/></CarouselItem>
                    <CarouselItem><RecordItem/></CarouselItem>
                </CarouselContent>
            </Carousel>
            <CarouselProgress count={count} current={current}
                reset={ () => api?.scrollTo(0) }
                next={ () => api?.scrollNext() }
                action={ () => {

                    completeIntroduction().then( () => redirect("/project/new/goal") )

                } }
            />
        </div>

    )

}