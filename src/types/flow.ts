import { Node } from "@xyflow/react";

export type Task = {

    task_name: string;
    bg_color: string;
    text_color: string;
    description: string;
    isAction: boolean;
    time_limit: {
        hours: number;
        minutes: number;
        seconds: number;
    };
    isLoop: boolean;
    repetitions_required: number;
    isCompleted: boolean;
    repetitions_completed: number;
    isRoot?: boolean;

}

export interface TableTaskRow extends Task {

    id: string;
    parent_node_id: string | null;
    project_id: string;
    pos_x: number;
    pos_y: number;

}

export type TableTaskRows = Record<string, TableTaskRow>;

export type PreviewChangeKind = "added" | "updated" | "moved" | "deleted";

/** Change info attached to nodes in the AI proposal preview only; never saved. */
export type PreviewChange = {

    kinds: PreviewChangeKind[];
    before?: Partial<Task>;
    after?: Partial<Task>;
    fromParent?: string | null;
    toParent?: string | null;
    reasons?: string[];

}

export type TaskNodeData = {

    label: string;
    task: Task;
    previewChange?: PreviewChange;

}

export type TaskNodeType = Node<TaskNodeData, 'taskNode'>;