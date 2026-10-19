import { TableTaskRow } from "./flow";

export type OnAirRecord = {

    id: number;
    node_id: string;
    project_id: string;
    user_id: string;
    started_at: string;
    completed_at: string;
    updated_at: string;
    duration: number;
    status: "active" | "completed" | "abandoned" | "paused";
    xp_change?: number;
    nodes?: TableTaskRow;
    projects: Project;
    reward_redeemed: boolean;
    resource_gained: Record<string, number>

}
