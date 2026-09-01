import { ReactFlowProvider } from "@xyflow/react";

export default async function ProjectPageTreeLayout({ children }: LayoutProps<"/project/[projectId]/tree">) {

	return (
		<>{children}</>
	);
}