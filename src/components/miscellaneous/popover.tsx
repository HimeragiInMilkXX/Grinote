import { PopoverRoot } from "@base-ui/react/popover"
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover"

const PopoverSimplfied = ( { trigger, content, props }: { trigger: React.ReactElement, content: React.ReactElement, props?: PopoverRoot.Props }) => {

    return (
        <Popover {...props} >
            <PopoverTrigger render={trigger}/>
            <PopoverContent className="w-fit">{content}</PopoverContent>
        </Popover>
    )
}

export default PopoverSimplfied
