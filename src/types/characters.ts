type Character = {

    id: number;
    name: string;
    group: string;
    description: number;
    growth_step: Record<number, number>

}

type CharacterLevelChanges = {

    prev_lv: number,
    prev_xp: number,
    xp_gained: number,

    growth_step: Record<number, number>

}

type Resource = {

    id: string;
    type: "food" | "sweet" | "drink",
    xp: number;
    name: string

}

type ProjectResource = {

    id: number;
    project_id: string;
    resource_id: number;
    quantity: number;
    
    resources?: Resource;

}