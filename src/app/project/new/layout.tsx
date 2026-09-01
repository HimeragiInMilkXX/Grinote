import { redirectIfNotAuthenticated } from "@/utils/redirectIfNotAuthenticated";

export default async function NewProjectLayout({ children }: LayoutProps<"/project/new">) {

	await redirectIfNotAuthenticated( "/login" );

	return (
		<main className="flex items-center justify-center h-screen">
            {children}
        </main>
	);
}