"use client"

import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../ui/dialog"

type Props = {

    onConfirm: () => void;
    onDecline: () => void;
    onPreview: () => void;
    isOpen: boolean;

}

const RequestedUpdateConfirmationPanel = ( { isOpen, onConfirm, onDecline, onPreview }: Props ) => {
    return (
        <Dialog open={isOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle> まだ反映されていない生成内容が一時保存されています。 </DialogTitle>
                    <DialogDescription>
                        放棄するか、確認するか、どちらかを選んで続いてご利用ください。
                    </DialogDescription>
                </DialogHeader>
                <div className="flex gap-3 items-center">

                    <Button onClick={onPreview} variant="secondary" className="bg-blue-300! hover:bg-blue-400! cursor-pointer"> プレビュー </Button>
                    <Button onClick={onConfirm} variant="secondary" className="bg-green-300! hover:bg-green-400! cursor-pointer"> 確認 </Button>
                    <Button onClick={onDecline} variant="secondary" className="bg-red-300! hover:bg-red-400! cursor-pointer"> 放棄 </Button>

                </div>
            </DialogContent>
        </Dialog>
    )
}

export default RequestedUpdateConfirmationPanel
