import { redirectIfNotAuthenticated } from "@/utils/redirectIfNotAuthenticated";

export default async function CalendarLayout( { children }: LayoutProps<"/calendar"> ) {

	await redirectIfNotAuthenticated( "/login" );

	return (
		<main className="mx-auto w-full max-w-6xl px-4 py-6 md:py-10">
			{children}
		</main>
	);
}
