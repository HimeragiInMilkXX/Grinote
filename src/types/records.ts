import { TableTaskRow } from "./flow";
import type { TimerState } from "@/lib/timer/types";

export type OnAirRecord = {

    id: number;
    node_id: string;
    project_id: string;
    user_id: string;
    started_at: string;
    completed_at: string;
    updated_at: string;
    duration: number;
    /** reviewing = timer stopped with 完成, task report pending, no XP yet (journey system) */
    status: "active" | "completed" | "abandoned" | "paused" | "reviewing";
    /** when 完成 was pressed (null before 4.0) */
    ended_at?: string | null;
    xp_change?: number;
    nodes?: TableTaskRow;
    projects: Project;
    /** true once the reward animation was shown (XP itself is awarded at completion) */
    reward_redeemed: boolean;
    resource_gained: Record<string, number>
    /** Reward snapshot (TaskRewardBreakdown, src/lib/rewards/breakdown.ts); null on records before Reward Engine v1.0 */
    reward_breakdown?: unknown;
    formula_version?: string | null;
    /** Work timer (MVP 4.5, src/lib/timer). Open records always have one; null on records before 4.5. */
    timer?: TimerState | null;

}
