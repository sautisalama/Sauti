import { EntityWorkspace } from "../../_components/EntityWorkspace";

export const metadata = { title: "project" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	return <EntityWorkspace kind="project" pageId={id} />;
}
