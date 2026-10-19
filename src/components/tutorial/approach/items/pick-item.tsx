import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function PickItem() {

    return (

        <Card className="border-none! shadow-none! border-0! ring-0!">
            <CardHeader>
                <CardTitle>今日取り組むことを一つ選びましょう</CardTitle>
            </CardHeader>
            <CardContent>
                <p>すべてを一度に進める必要はありません。</p>
                <p>今の自分が取り組めそうな小さなタスクを一つ選び、実際に行動してみましょう。</p>
            </CardContent>
        </Card>

    )

}
