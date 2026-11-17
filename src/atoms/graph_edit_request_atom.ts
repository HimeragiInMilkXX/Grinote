import { TaskNodeType } from "@/types/flow";
import { Edge } from "@xyflow/react";
import { atom } from "jotai";

type GraphEditRequest = {

    project_id: string,
    nodes: TaskNodeType[];
    edges: Edge[];

}

export const graphEditRequestAtom = atom<GraphEditRequest | null>(null);