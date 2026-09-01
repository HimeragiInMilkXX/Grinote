export default function AuthLayout({ children }: LayoutProps<"/">) {
	return (
		<main className="flex items-center justify-center h-screen">
            {children}
        </main>
	);
}