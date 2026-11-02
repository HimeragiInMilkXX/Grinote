"use client";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";
import Link from "next/link";

interface NewProjectCompletePanelProps {

    project: Project;

}

const NewProjectCompletePanel = ( { project }: NewProjectCompletePanelProps ) => {

    return (
        <Card className="w-full sm:max-w-md">

            <CardHeader>
                <CardTitle> プロジェクト作成完了！ </CardTitle>
            </CardHeader>

            <CardContent className="relative flex flex-col gap-3">
                <Image loading="eager" src={`/character/thumbnail/${project.characters?.name}.png`} width={500} height={500} className="object-cover aspect-square" alt="character"/>
                <section className="flex flex-col gap-3">

                    <h3 className="text-4xl font-bold"> {project.name} </h3>
                    <p className="text-2xl font-light"> {project.final_goal}に向けて、頑張りましょう！ </p>

                </section>
            </CardContent>

            <CardFooter>
                <Link href={`/project/${project.id}/dashboard`} className={buttonVariants({ variant: "default" }) + ' w-full'} >
                    プロジェクトダッシュボードへ
                </Link>
            </CardFooter>

        </Card>
    )
}

export default NewProjectCompletePanel
