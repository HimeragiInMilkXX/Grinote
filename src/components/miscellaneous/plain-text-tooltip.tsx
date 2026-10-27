import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip"

type Side = React.ComponentProps<typeof TooltipContent>["side"];

type Props = {

    children: React.ReactElement;
    popupElement?: React.ReactElement;
    text?: string;
    side?: Side;

}

const PlainTextToolTip = ( { children, popupElement, text, side = "right" }: Props ) => {
    return (
        <Tooltip key={side}>

            <TooltipTrigger render={children}/>

            <TooltipContent side={side} sideOffset={10} render={popupElement ? popupElement : <p>{text}</p>} />

        </Tooltip>
    )
}

export default PlainTextToolTip
