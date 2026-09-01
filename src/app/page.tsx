import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { redirectIfAuthenticated } from "@/utils/redirectIfAuthenticated";

export default async function Home() {

	await redirectIfAuthenticated( "/dashboard" );

	return (

		<div>

			<Link
				href="/login"
				className={buttonVariants({ variant: "default", size: "lg" })}
				>
				Login
			</Link>

		</div>

	);

}
