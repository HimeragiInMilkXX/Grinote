import NewProjectCompletePanel from "@/components/project/new/new-project-complete-panel"
import { redirectIfNotAuthenticated } from "@/utils/redirectIfNotAuthenticated"
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

interface PageProps {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

const NewProjectCompletePage = async ( { searchParams }: PageProps ) => {

    const params = await searchParams;
    const projectId = params.projectId;

    const user = await redirectIfNotAuthenticated();

    const supabase = await createClient();

    const { data: project, error: projectError } = await supabase.from('projects').select('*, characters ( * )').eq("id", projectId).eq("user_id", user.id).maybeSingle();

    if( projectError || project.user_id !== user.id ) redirect("/dashboard")

    return (

        <NewProjectCompletePanel project={project}/>

    )

}

export default NewProjectCompletePage
