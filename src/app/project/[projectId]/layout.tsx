import AssistantDrawer from "@/components/assistant/assistant-drawer";
import { Chat } from "@/components/assistant/chat";
import ProjectNavigation from "@/components/navigation/project-navigation";
import ProjectTutorialPanel from "@/components/tutorial/project/project-tutorial-panel";
import { MODELS } from "@/lib/ai/models";
import { getProject } from "@/lib/projects";
import { redirectIfNotAuthenticated } from "@/utils/redirectIfNotAuthenticated";
import { redirect } from "next/navigation";
import { ChatProvider } from "@/providers/chat-provider";

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

	return (
		<main className="flex items-center justify-center h-screen relative">
			<ProjectNavigation projectId={projectId}/>
            {children}
			<ProjectTutorialPanel className="absolute right-0 top-0 m-6 w-[20vw] z-10" project_id={projectId} tutorial_progress={project.tutorial_progress}/>

			<ChatProvider models={MODELS} >

				<AssistantDrawer>
					<Chat project_id={projectId} />
				</AssistantDrawer>

			</ChatProvider>
		</main>
	);
}