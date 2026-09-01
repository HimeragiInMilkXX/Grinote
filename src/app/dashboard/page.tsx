import LogoutButton from "@/components/auth/logout-button";
import DashboardProjectList from "@/components/project/display/dashboard-project-list";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/server";
import { Plus } from "lucide-react";
import Link from "next/link";

const Dashboard = async () => {

    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    
    const { data: projects, error: projectError } = await supabase.from('projects').select('*, characters ( * )').eq("user_id", user?.id)

    return (
        <div className="flex flex-col gap-3">

            <section className="flex items-center justify-between gap-6">
                <h2 className="text-xl"> Welcome to Dashboard </h2>
                <div className="flex items-center gap-1.5">
                    <Link href="/project/new/goal" className={buttonVariants({ variant: "secondary" })} >
                        <Plus className=""/>
                    </Link>
                    <LogoutButton/>
                </div>
            </section>

            <DashboardProjectList projects={projects} />

        </div>
    )
}

export default Dashboard
