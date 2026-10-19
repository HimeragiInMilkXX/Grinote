import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function RecordItem() {

    return (

        <Card className="border-none! shadow-none! border-0! ring-0!">
            <CardHeader>
                <CardTitle>小さな前進を記録しましょう</CardTitle>
            </CardHeader>
            <CardContent>
                <p>タスクを完了すると、その行動がプロジェクトの進捗として記録されます。</p>
                <p>できたことを確認しながら、次の一歩へ進んでいきましょう。</p>
                <p className="p-3 font-bold">あなたの目標を、今日できる行動から始めてみましょう。</p>
            </CardContent>
        </Card>

    )

}
