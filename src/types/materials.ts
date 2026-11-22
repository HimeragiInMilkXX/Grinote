export type Material = {

    id: number;
    project_id: string;
    type: MaterialType;
    label: string;
    color: string;
    link: string;
    name: string;
    description: string;
    content: string;

    is_favourite: boolean;
    /** ISO timestamp when pinned, null when not pinned */
    pinned_at: string | null;

    created_at: string;
    updated_at: string;

}

export const materialColumnsCaption: Record<string, string> = {

    type: "タイプ",
    label: "ラベル",
    color: "カラー",
    created_at: "作成日時",
    updated_at: "更新日時"

}

export type MaterialArrangableColumns = "type" | "label" | "color" | "created_at" | "updated_at"

export type MaterialFilterableColumns = "type" | "color" | "label"

export type MaterialPagination = {

    materials: Material[],
    total: number,
    totalPages: number

}

export type MaterialType = "playables" | "readonlys" | "externals" | "memos"
export type MaterialTypeCaptions = "メディア" | "閲覧資料" | "外部リンク" | "メモ"

export const materialTypeCaptions: Record<MaterialType, MaterialTypeCaptions> = {

    playables: "メディア",
    readonlys: "閲覧資料",
    externals: "外部リンク",
    memos: "メモ",

}

/** Lightweight material row for pickers / link lists */
export type MaterialSummary = Pick<Material, "id" | "name" | "type" | "label" | "color" | "is_favourite" | "pinned_at">

export type MaterialNodeLink = { material_id: number, node_id: string, project_id: string }
