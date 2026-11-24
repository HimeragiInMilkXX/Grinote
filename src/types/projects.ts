type Project = {

    /** yyyy-MM-dd */
    achieve_date_goal: string;
    character_given_name: string;
    /** set once the one-time character rename has been used */
    character_name_changed_at: string | null;
    character_id: number;
    character_level: number;
    character_xp: number;
    created_at: Date;
    daily_time_goal: string;
    description: string;
    final_goal: string;
    id: string;
    name: string;
    streak: number;
    user_id: string;
    /** ISO weekdays, 1 = Mon ... 7 = Sun (see src/lib/projects/work-days.ts) */
    work_days: number[];
    tutorial_progress: [ boolean, boolean, boolean, boolean, boolean ]

    characters?: Character

}