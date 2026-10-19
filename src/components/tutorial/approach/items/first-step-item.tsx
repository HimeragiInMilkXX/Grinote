import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function FirstStepItem() {

    return (

        <Card className="border-none! shadow-none! border-0! ring-0!">
            <CardHeader>
                <CardTitle>まずは、大きな目標を決めましょう</CardTitle>
            </CardHeader>
            <CardContent>
                <p>勉強、仕事、趣味、習慣づくりなど、あなたが取り組みたいことをプロジェクトとして登録します。</p>
                <p>まだ具体的な計画が決まっていなくても大丈夫です。</p>
            </CardContent>
        </Card>

    )

}
