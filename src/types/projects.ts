type Project = {

    achieve_data_goal: Date;
    character_given_name: string;
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
    work_days: boolean[];
    tutorial_progress: [ boolean, boolean, boolean, boolean, boolean ]

    characters?: Character

}