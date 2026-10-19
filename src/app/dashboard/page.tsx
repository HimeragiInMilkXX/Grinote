import LogoutButton from "@/components/auth/logout-button";
import DashboardProjectList from "@/components/project/dashboard-project-list";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/server";
import { Plus } from "lucide-react";
import Link from "next/link";
import { hasDoneIntroduction } from "./serverActions";
import ApproachTutorialDialog from "@/components/tutorial/approach/approach-tutorial-dialog";

const Dashboard = async () => {

    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    
    const { data: projects, error: projectError } = await supabase.from('projects').select('*, characters ( * )').eq("user_id", user?.id)

    const isIntroductionDone = await hasDoneIntroduction();

    return (
        <div className="flex flex-col gap-3">

            <section className="flex items-center justify-between gap-6">
                <h2 className="text-xl"> Grinoteへようこそ </h2>
                <div className="flex items-center gap-1.5">
                    <Link href="/project/new/goal" className={buttonVariants({ variant: "secondary" })} >
                        <Plus className=""/>
                    </Link>
                    <LogoutButton/>
                </div>
            </section>

            <DashboardProjectList projects={projects} />
            <ApproachTutorialDialog isIntroductionDone={isIntroductionDone}/>

        </div>
    )
}

export default Dashboard
