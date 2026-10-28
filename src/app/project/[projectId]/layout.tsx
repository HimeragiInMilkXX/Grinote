import ProjectNavigation from "@/components/navigation/project-navigation";
import ProjectTutorialPanel from "@/components/tutorial/project/project-tutorial-panel";
import { getProject } from "@/lib/projects";
import { redirectIfNotAuthenticated } from "@/utils/redirectIfNotAuthenticated";
import { redirect } from "next/navigation";

export default async function ProjectPageLayout({ children, params }: LayoutProps<"/project/[projectId]">) {

	await redirectIfNotAuthenticated( "/login" );

	const { projectId } = await params;

	let project: Project;

	try {

		project = await getProject( projectId );

	} catch( e: any ) {

		console.log( e.message );
		redirect("/dashboard")

	}

    let isTutorialCompleted = true;

    for( const step of project.tutorial_progress ) {

        if( !step ) {

            isTutorialCompleted = false;
            break;

        }

    }

	return (
		<main className="flex items-center justify-center h-screen">
			<ProjectNavigation projectId={projectId}/>
            {children}
			{ !isTutorialCompleted && <ProjectTutorialPanel className="absolute right-0 top-0 m-6 w-[20vw]" project_id={projectId} tutorial_progress={project.tutorial_progress}/> }
        </main>
	);
}