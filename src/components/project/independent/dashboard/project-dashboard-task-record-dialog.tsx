import { OnAirRecord } from "@/types/records"
import {
    Dialog,
    DialogContent,
    DialogTrigger,
} from "@/components/ui/dialog"
import { buttonVariants } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { getMsFormatted, timestampToLocalDateTime } from "@/utils/utils"

type Props = {

    records: OnAirRecord[]

}

const ProjectDashboardTaskRecordDialog = ( { records }: Props ) => {
    return (
        <Dialog>
            <DialogTrigger className={buttonVariants({variant: "default"})}> 記録一覧 </DialogTrigger>
            <DialogContent className="max-w-fit!">
                <Table>
                    <TableCaption>過去タスク記録</TableCaption>
                    <TableHeader>
                        <TableRow>
                        <TableHead className="w-25">開始日時</TableHead>
                        <TableHead>タスクネーム</TableHead>
                        <TableHead>終了日時</TableHead>
                        <TableHead>所要時間</TableHead>
                        <TableHead className="text-right">ステータス</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {

                            records.length > 0 ? records.map( ( record, i ) =>

                                <TableRow key={i}>
                                    <TableCell> {timestampToLocalDateTime(record.started_at).date} {timestampToLocalDateTime(record.started_at).time} </TableCell>
                                    <TableCell> {record.nodes?.task_name} </TableCell>
                                    <TableCell> {timestampToLocalDateTime(record.updated_at).date} {timestampToLocalDateTime(record.updated_at).time} </TableCell>
                                    <TableCell> {getMsFormatted(record.duration).str} </TableCell>
                                    <TableCell className="text-right"> {record.status} </TableCell>
                                </TableRow>

                            ) : (

                                <TableRow>
                                    <TableCell className="text-center p-3" colSpan={5} > まだ完成記録はない </TableCell>
                                </TableRow>

                            )

                        }
                    </TableBody>
                </Table>
            </DialogContent>
        </Dialog>
    )
}

export default ProjectDashboardTaskRecordDialog
