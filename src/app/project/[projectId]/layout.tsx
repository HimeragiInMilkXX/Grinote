import ProjectNavigation from "@/components/navigation/project-navigation";
import { getProject } from "@/lib/projects";
import { redirectIfNotAuthenticated } from "@/utils/redirectIfNotAuthenticated";
import { redirect } from "next/navigation";

export default async function ProjectPageLayout({ children, params }: LayoutProps<"/project/[projectId]">) {

	await redirectIfNotAuthenticated( "/login" );

	const { projectId } = await params;

	try {

		await getProject( projectId );

	} catch( e: any ) {

		console.log( e.message );
		redirect("/dashboard")

	}

	return (
		<main className="flex items-center justify-center h-screen">
			<ProjectNavigation projectId={projectId}/>
            {children}
        </main>
	);
}