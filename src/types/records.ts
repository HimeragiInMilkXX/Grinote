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
    /** true once the reward animation was shown (XP itself is awarded at completion) */
    reward_redeemed: boolean;
    resource_gained: Record<string, number>
    /** Reward snapshot (TaskRewardBreakdown, src/lib/rewards/breakdown.ts); null on records before Reward Engine v1.0 */
    reward_breakdown?: unknown;
    formula_version?: string | null;

}
