import { redirectIfNotAuthenticated } from "@/utils/redirectIfNotAuthenticated";

export default async function NewProjectLayout({ children }: LayoutProps<"/project/new">) {

	await redirectIfNotAuthenticated( "/login" );

	return (
		<main className="flex items-center justify-center min-h-screen px-4 py-8">
            {children}
        </main>
	);
}