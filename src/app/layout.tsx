import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

const notoSansJP = Noto_Sans_JP({
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Grinote - MVP",
	description: "Minimum Viable Product of Grinote",
	icons: ['/logo.svg']
};

export default function RootLayout({ children }: LayoutProps<"/">) {
	return (
		<html
			lang="ja"
			className={`${notoSansJP.className} h-full antialiased`}
		>
			<body className="min-h-full flex flex-col">
				<TooltipProvider>{children}</TooltipProvider>
				<Toaster/>
			</body>
		</html>
	);
}
