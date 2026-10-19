import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function BreakdownItem() {

    return (

        <Card className="border-none! shadow-none! border-0! ring-0!">
            <CardHeader>
                <CardTitle>目標を、小さな行動に分けましょう</CardTitle>
            </CardHeader>
            <CardContent>
                <p>勉強、仕事、趣味、習慣づくりなど、あなたが取り組みたいことをプロジェクトとして登録します。</p>
                <p>Grinoteでは、目標をいくつかの段階や具体的なタスクに分けて整理します。</p>
                <p>必要に応じて、あとから編集したり、順番を変えたりできます。</p>
            </CardContent>
        </Card>

    )

}
